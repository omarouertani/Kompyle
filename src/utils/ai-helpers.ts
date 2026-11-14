import type { z } from "zod";
import { formatZodIssues } from "@/schemas/resumeSchema";

/**
 * Extraction JSON « à l'épreuve des balles » pour les sorties LLM — adapté de la
 * sanitization de Reactive Resume (packages/ai/.../sanitize.ts).
 *
 * On reprend leurs 2 idées clés — extraction par bornes + réparation — SANS la
 * dépendance `jsonrepair` : une réparation maison des erreurs LLM les plus
 * courantes (fences markdown, virgules traînantes, guillemets typographiques).
 */

/**
 * Retire les fences markdown puis isole la sous-chaîne JSON (du 1er `{`/`[`
 * jusqu'au dernier `}`/`]`). Technique `getJsonBoundaryIndices` de RR : tout
 * texte avant/après l'objet (préambule bavard du modèle, etc.) est ignoré.
 */
export function extractJsonString(raw: string): string {
  let s = raw.trim();

  // ```json ... ```  ou  ``` ... ```
  s = s
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstCurly = s.indexOf("{");
  const firstSquare = s.indexOf("[");
  const starts = [firstCurly, firstSquare].filter((i) => i !== -1);
  const first = starts.length > 0 ? Math.min(...starts) : -1;
  const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));

  if (first !== -1 && last !== -1 && last >= first) {
    s = s.slice(first, last + 1);
  }

  return s;
}

/** Répare les erreurs JSON les plus fréquentes des LLM (sans dépendance externe). */
export function lightRepairJson(s: string): string {
  return (
    s
      // guillemets typographiques → guillemets droits
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      // virgules traînantes : { "a": 1, } → { "a": 1 }   /   [1, 2, ] → [1, 2]
      .replace(/,(\s*[}\]])/g, "$1")
  );
}

/** Extrait + parse, avec une 2e tentative après réparation légère. Lève si invalide. */
export function parseAiJson(raw: string): unknown {
  const extracted = extractJsonString(raw);
  try {
    return JSON.parse(extracted);
  } catch {
    return JSON.parse(lightRepairJson(extracted));
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Complète une réponse PARTIELLE de l'IA avec le document source : certains
 * modèles (ex. Groq gpt-oss) ne renvoient que les sections qu'ils ont modifiées.
 * Une clé absente (ou null) reprend la valeur source ; pour un objet imbriqué
 * présent des deux côtés (personalInfo), on complète ses sous-clés de la même
 * façon. Les tableaux renvoyés par l'IA ne sont jamais fusionnés.
 * Renvoie aussi la liste des clés complétées (journalisation).
 */
export function fillMissingFromSource(parsed: unknown, source: unknown): { value: unknown; filled: string[] } {
  if (!isPlainObject(parsed) || !isPlainObject(source)) return { value: parsed, filled: [] };
  const filled: string[] = [];
  const out: Record<string, unknown> = { ...parsed };
  for (const [key, srcValue] of Object.entries(source)) {
    const cur = out[key];
    if (cur === undefined || cur === null) {
      if (srcValue !== undefined) {
        out[key] = srcValue;
        filled.push(key);
      }
    } else if (isPlainObject(cur) && isPlainObject(srcValue)) {
      const nested = fillMissingFromSource(cur, srcValue);
      out[key] = nested.value;
      filled.push(...nested.filled.map((k) => `${key}.${k}`));
    }
  }
  return { value: out, filled };
}

export type AiExtractionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; issues: string[] };

/**
 * Pipeline complet : extrait le JSON d'une réponse LLM, le parse (avec
 * réparation), puis le valide STRICTEMENT contre un schéma Zod. Ne lève jamais —
 * renvoie un résultat discriminé exploitable directement par la route API.
 */
export function extractAndValidate<S extends z.ZodTypeAny>(
  raw: string,
  schema: S,
  /** Document source : complète les clés que l'IA a omises (réponse partielle). */
  source?: unknown,
): AiExtractionResult<z.infer<S>> {
  let parsed: unknown;
  try {
    parsed = parseAiJson(raw);
    if (source !== undefined) {
      const { value, filled } = fillMissingFromSource(parsed, source);
      if (filled.length > 0) console.warn("[ai] partial answer — kept source values for:", filled.join(", "));
      parsed = value;
    }
  } catch {
    return {
      success: false,
      error: "La réponse de l'IA n'est pas un JSON exploitable.",
      issues: [raw.slice(0, 300)],
    };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      error: "JSON valide mais structure non conforme au schéma.",
      issues: formatZodIssues(result.error),
    };
  }

  return { success: true, data: result.data };
}
