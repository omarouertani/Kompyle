import type { CVData, CoverLetterData } from "@/types/cv";
import { summarizeExperience } from "@/lib/cv-analysis";
import { stripHtml } from "@/utils/strip-html";

/**
 * GARDE-FOU « années d'expérience » : l'IA peut restructurer et reformuler le
 * CV, mais ne doit JAMAIS changer le nombre d'années d'expérience.
 *
 * Référence : le nombre ÉCRIT dans le CV (« 5 ans d'expérience ») prime sur le
 * calcul à partir des dates (qui court jusqu'à aujourd'hui et peut gonfler le
 * total). À défaut de nombre écrit, on prend le calcul (années pleines).
 */

const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const YEARS = String.raw`(?:ans|années|annees|an|years?|yrs?)`;
const EXP = String.raw`(?:d['’]\s*|de\s+|of\s+)?(?:exp[ée]riences?|experience)`;

/** « 5 ans », « 5+ years », « 8 années » — toute mention d'années. */
const ANY_YEARS_RE = new RegExp(String.raw`\b${NUM}(\s*\+?\s*)${YEARS}\b`, "gi");
/** Mentions qui parlent explicitement d'EXPÉRIENCE : « 5 ans d'expérience »,
 *  « 8+ years of experience », « expérience de 5 ans », « experience of 5 years ». */
const EXP_YEARS_RE = new RegExp(
  String.raw`\b${NUM}(\s*\+?\s*)${YEARS}\s+${EXP}|\b(?:exp[ée]rience|experience)\s+(?:de|of)\s+(?:plus\s+de\s+|more\s+than\s+|over\s+)?${NUM}(\s*\+?\s*)${YEARS}\b`,
  "gi"
);

const toNumber = (s: string): number => Number(s.replace(",", "."));

function yearsIn(text: string, re: RegExp): number[] {
  const out: number[] = [];
  for (const m of stripHtml(text ?? "").matchAll(re)) {
    const n = m[1] ?? m[3];
    if (n) out.push(toNumber(n));
  }
  return out;
}

/** Textes « d'en-tête » où une durée en années désigne l'expérience TOTALE. */
const headlineTexts = (cv: Pick<CVData, "personalInfo">): string[] => [
  cv.personalInfo?.summary ?? "",
  cv.personalInfo?.role ?? "",
  cv.personalInfo?.techLine ?? "",
];

/** Tous les textes rédigés d'un CV (pour connaître les nombres déjà présents). */
const allTexts = (cv: CVData): string[] => [
  ...headlineTexts(cv),
  ...(cv.experiences ?? []).flatMap((e) => e.bullets ?? []),
  ...(cv.projects ?? []).map((p) => p.description ?? ""),
  ...(cv.customSections ?? []).map((c) => c.content ?? ""),
];

export interface ExperienceYearsPolicy {
  /** Nombre d'années à utiliser partout. */
  years: number;
  /** "stated" = écrit dans le CV ; "computed" = calculé depuis les dates. */
  source: "stated" | "computed";
  /** Nombres d'années déjà présents dans le CV source (jamais corrigés). */
  allowed: Set<number>;
}

export function experienceYearsPolicy(cv: CVData): ExperienceYearsPolicy {
  const stated = headlineTexts(cv).flatMap((t) => yearsIn(t, ANY_YEARS_RE));
  const computed = Math.floor(summarizeExperience(cv.experiences ?? []).totalMonths / 12);
  const years = stated.length > 0 ? Math.max(...stated) : computed;
  const allowed = new Set<number>([years, ...allTexts(cv).flatMap((t) => yearsIn(t, ANY_YEARS_RE))]);
  return { years, source: stated.length > 0 ? "stated" : "computed", allowed };
}

/** Bloc de prompt : le nombre d'années IMPOSÉ à l'IA. */
export function experienceYearsPromptRule(policy: ExperienceYearsPolicy): string {
  const origin = policy.source === "stated" ? "as written in the candidate's CV" : "computed from the CV dates";
  return `- YEARS OF EXPERIENCE: the candidate has EXACTLY ${policy.years} years of experience (${origin}). Whenever you mention years of experience (summary, title, bullets, letter), write EXACTLY ${policy.years} — never a higher or lower number, never recompute it from the dates, even if the job asks for more.`;
}

/**
 * Corrige un texte : tout nombre d'années d'expérience inventé est remplacé par
 * le nombre de référence. `headline` : dans le résumé / titre, TOUTE mention
 * d'années vaut expérience totale ; ailleurs, seules les tournures explicites
 * (« X ans d'expérience ») sont contrôlées.
 */
function fixText(text: string, policy: ExperienceYearsPolicy, headline: boolean, fixes: string[]): string {
  if (!text) return text;
  const re = new RegExp((headline ? ANY_YEARS_RE : EXP_YEARS_RE).source, "gi");
  return text.replace(re, (match: string, ...groups: (string | undefined)[]) => {
    const n = groups[0] ?? groups[2];
    if (!n || policy.allowed.has(toNumber(n))) return match;
    fixes.push(`${match.trim()} → ${policy.years}`);
    return match.replace(n, String(policy.years));
  });
}

/** Applique le garde-fou à un CV produit par l'IA. Renvoie les corrections faites. */
export function enforceExperienceYears(adapted: CVData, policy: ExperienceYearsPolicy): string[] {
  const fixes: string[] = [];
  const pi = adapted.personalInfo;
  pi.summary = fixText(pi.summary, policy, true, fixes);
  pi.role = fixText(pi.role, policy, true, fixes);
  pi.techLine = fixText(pi.techLine, policy, true, fixes);
  adapted.experiences = (adapted.experiences ?? []).map((e) => ({
    ...e,
    bullets: (e.bullets ?? []).map((b) => fixText(b, policy, false, fixes)),
  }));
  adapted.projects = (adapted.projects ?? []).map((p) => ({ ...p, description: fixText(p.description, policy, false, fixes) }));
  if (adapted.customSections) {
    adapted.customSections = adapted.customSections.map((c) => ({ ...c, content: fixText(c.content, policy, false, fixes) }));
  }
  return fixes;
}

/** Même garde-fou pour une lettre de motivation (tournures explicites seulement). */
export function enforceExperienceYearsInLetter(letter: CoverLetterData, policy: ExperienceYearsPolicy): string[] {
  const fixes: string[] = [];
  letter.paragraphs = (letter.paragraphs ?? []).map((p) => fixText(p, policy, false, fixes));
  letter.subject = fixText(letter.subject, policy, false, fixes);
  return fixes;
}
