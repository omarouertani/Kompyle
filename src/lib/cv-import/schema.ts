import { z } from "zod";
import type { AIProvider, CVData } from "@/types/cv";

/**
 * Schéma de la réponse de l'IA pour l'IMPORT d'un CV.
 *
 * Plus tolérant que `resumeSchema` (adaptation) : un vrai CV peut n'avoir ni
 * formation ni projet, et les modèles renvoient souvent `null`, un nombre
 * (« 2020 ») ou un tableau là où le modèle attend une chaîne. On accepte ces
 * écarts de FORME (convertis), mais une réponse qui n'est pas un objet JSON
 * avec ces sections reste rejetée → relance auto-correctrice.
 */

/** Chaîne tolérante : null/undefined → "", nombre → texte, tableau → jointure. */
const text = z.preprocess((v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" || typeof x === "number").join(", ");
  return v;
}, z.string());

/** Tableau tolérant : null/undefined → [], valeur seule → [valeur]. */
function list<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]), z.array(item));
}

/** Objet tolérant : null/undefined → {}. */
function obj<T extends z.ZodRawShape>(shape: T) {
  return z.preprocess((v) => (v === null || v === undefined ? {} : v), z.object(shape));
}

/** Langue : chaîne, ou objet { language, level } aplati en « Langue (niveau) ». */
const language = z.preprocess((v) => {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const name = String(o.language ?? o.name ?? "").trim();
    const level = String(o.level ?? o.proficiency ?? "").trim();
    return level ? `${name} (${level})` : name;
  }
  return v;
}, text);

export const importedCvSchema = z.object({
  personalInfo: obj({
    name: text,
    role: text,
    techLine: text,
    email: text,
    phone: text,
    location: text,
    linkedin: text,
    portfolio: text,
    summary: text,
    birthDate: text,
    certifications: text,
    interests: text,
  }),
  skills: list(obj({ category: text, items: text })),
  spokenLanguages: list(language),
  education: list(obj({ degree: text, institution: text, date: text })),
  experiences: list(obj({ title: text, org: text, date: text, bullets: list(text) })),
  projects: list(obj({ title: text, description: text, stack: text })),
  customSections: list(obj({ title: text, content: text })),
});

export type ImportedCVRaw = z.infer<typeof importedCvSchema>;

/** CV importé, prêt à être appliqué (sans mise en page : elle reste celle de l'utilisateur). */
export type ImportedCV = Omit<CVData, "layout">;

/** Codes d'avertissement affichés sur l'écran de vérification (namespace CVImport). */
export type ImportWarning =
  | "missing_name"
  | "missing_email"
  | "missing_phone"
  | "no_experience"
  | "no_education"
  | "no_skills"
  | "experience_dates";

/** Garde-fous de volume : au-delà, c'est du bruit (texte mal découpé). */
const MAX_ITEMS = 40;
const MAX_BULLETS = 20;

/** Texte propre : balises retirées, espaces normalisés (sauts de ligne gardés). */
function clean(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Puce sans son marqueur (•, -, *, ▪…) : le modèle de CV dessine déjà les puces. */
function cleanBullet(s: string): string {
  return clean(s).replace(/^[•\-*▪◦●·–—]\s*/, "").trim();
}

const newId = (): string => crypto.randomUUID();

/**
 * Normalise la réponse validée : nettoyage, éléments vides retirés, ids neufs,
 * volumes bornés. Ne renvoie AUCUNE donnée du CV courant (remplacement complet).
 */
export function normalizeImportedCV(raw: ImportedCVRaw): ImportedCV {
  const pi = raw.personalInfo;
  const opt = (s: string) => {
    const c = clean(s);
    return c ? c : undefined;
  };
  return {
    personalInfo: {
      name: clean(pi.name),
      role: clean(pi.role),
      techLine: clean(pi.techLine),
      email: clean(pi.email).replace(/^mailto:/i, ""),
      phone: clean(pi.phone),
      location: clean(pi.location),
      linkedin: clean(pi.linkedin).replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""),
      portfolio: opt(pi.portfolio)?.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, ""),
      summary: clean(pi.summary),
      birthDate: opt(pi.birthDate),
      certifications: opt(pi.certifications),
      interests: opt(pi.interests),
    },
    skills: raw.skills
      .map((s) => ({ id: newId(), category: clean(s.category), items: clean(s.items) }))
      .filter((s) => s.items)
      .slice(0, MAX_ITEMS),
    spokenLanguages: raw.spokenLanguages.map(clean).filter(Boolean).slice(0, MAX_ITEMS),
    education: raw.education
      .map((e) => ({ id: newId(), degree: clean(e.degree), institution: clean(e.institution), date: clean(e.date) }))
      .filter((e) => e.degree || e.institution)
      .slice(0, MAX_ITEMS),
    experiences: raw.experiences
      .map((e) => ({
        id: newId(),
        title: clean(e.title),
        org: clean(e.org),
        date: clean(e.date),
        bullets: e.bullets.map(cleanBullet).filter(Boolean).slice(0, MAX_BULLETS),
      }))
      .filter((e) => e.title || e.org || e.bullets.length > 0)
      .slice(0, MAX_ITEMS),
    projects: raw.projects
      .map((p) => ({ id: newId(), title: clean(p.title), description: clean(p.description), stack: opt(p.stack) }))
      .filter((p) => p.title || p.description)
      .slice(0, MAX_ITEMS),
    customSections: raw.customSections
      .map((c) => ({ id: newId(), title: clean(c.title), content: clean(c.content) }))
      .filter((c) => c.content)
      .slice(0, MAX_ITEMS),
  };
}

/** Vrai si l'extraction n'a rien trouvé qui ressemble à un CV. */
export function isEmptyImport(cv: ImportedCV): boolean {
  const pi = cv.personalInfo;
  return (
    !pi.name && !pi.email && !pi.summary &&
    cv.experiences.length === 0 && cv.education.length === 0 && cv.skills.length === 0
  );
}

/** Ce qui manque, pour l'écran de vérification. */
export function importWarnings(cv: ImportedCV): ImportWarning[] {
  const w: ImportWarning[] = [];
  if (!cv.personalInfo.name) w.push("missing_name");
  if (!cv.personalInfo.email) w.push("missing_email");
  if (!cv.personalInfo.phone) w.push("missing_phone");
  if (cv.experiences.length === 0) w.push("no_experience");
  else if (cv.experiences.some((e) => !e.date)) w.push("experience_dates");
  if (cv.education.length === 0) w.push("no_education");
  if (cv.skills.length === 0) w.push("no_skills");
  return w;
}

// ─── Contrat de la route /api/import-cv ─────────────────────────────────────

export interface ImportCVRequest {
  text: string;
  provider?: AIProvider;
  model?: string;
  /** Clé API du provider (BYOK). Jamais loggée. */
  apiKey?: string;
}

export interface ImportCVResponse {
  cv: ImportedCV;
  warnings: ImportWarning[];
  provider: AIProvider;
  model: string;
}

/** Codes d'erreur traduits côté client (namespace CVImport). */
export type ImportErrorCode = "rate_limited" | "too_large" | "too_short" | "invalid_request" | "ai_failed" | "invalid_output" | "not_a_cv";
