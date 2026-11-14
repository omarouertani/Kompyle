import type { CVData, CVLang, SectionId } from "@/types/cv";
import { detectJobLanguage } from "@/lib/detect-language";
import { stripHtml } from "@/utils/strip-html";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

/**
 * Langue du DOCUMENT CV (≠ langue de l'interface). Les libellés imprimés dans
 * le CV (titres de section…) viennent des catalogues `messages/*.json`
 * (namespace `CVDocument`) — aucun libellé codé en dur dans les templates.
 */
export const CV_LANGS: readonly CVLang[] = ["fr", "en"];

const DOC = { fr: fr.CVDocument, en: en.CVDocument } as const;

export const isCVLang = (v: unknown): v is CVLang => v === "fr" || v === "en";

export const otherLang = (lang: CVLang): CVLang => (lang === "fr" ? "en" : "fr");

/** Textes du namespace CVDocument pour une langue (hors titres de section). */
export const cvDocText = (lang: CVLang) => DOC[lang];

/** Détecte la langue d'un CV à partir de son contenu rédigé (titre, résumé,
 *  réalisations, formations). Déterministe, sans appel réseau. */
export function detectCVLanguage(cv: Pick<CVData, "personalInfo" | "experiences" | "education" | "projects">): CVLang {
  const parts = [
    cv.personalInfo?.role,
    cv.personalInfo?.summary,
    ...(cv.experiences ?? []).flatMap((e) => [e.title, ...(e.bullets ?? [])]),
    ...(cv.education ?? []).map((e) => e.degree),
    ...(cv.projects ?? []).map((p) => p.description),
  ];
  return detectJobLanguage(stripHtml(parts.filter(Boolean).join(" ")));
}

/** Langue d'un CV : champ explicite, sinon détection sur le contenu (anciens CV). */
export const cvLanguage = (cv: CVData): CVLang => (isCVLang(cv.language) ? cv.language : detectCVLanguage(cv));

/** Vrai pour le layout mono-colonne du CV canadien (titres de section propres). */
const isSingleColumn = (cv?: CVData): boolean => {
  const pages = cv?.layout?.pages ?? [];
  return pages.length > 0 && pages.every((p) => p.sidebar.length === 0);
};

/** Libellés par défaut des sections built-in dans une langue. */
export function sectionLabels(lang: CVLang, canadian = false): Record<SectionId, string> {
  const base = DOC[lang].sections as Record<SectionId, string>;
  return canadian ? { ...base, ...(DOC[lang].sections_canadian as Partial<Record<SectionId, string>>) } : { ...base };
}

/** Anciens libellés par défaut (codés en dur avant l'i18n) : un titre stocké
 *  égal à l'un d'eux n'est pas un renommage de l'utilisateur. */
const LEGACY_DEFAULTS = [
  "Résumé", "Expériences", "Formations", "Intérêts", "Expériences Professionnelles",
  "Compétences", "Langues", "Projets", "Profil", "Formation", "Summary", "Experience",
  "Skills", "Languages", "Education", "Projects", "Interests",
];

const DEFAULT_LABELS = new Set(
  [
    ...LEGACY_DEFAULTS,
    ...CV_LANGS.flatMap((l) => [...Object.values(sectionLabels(l)), ...Object.values(sectionLabels(l, true))]),
  ].map((s) => s.trim().toLowerCase())
);

/** Vrai si un titre stocké n'est qu'un libellé par défaut (dans n'importe quelle
 *  langue) sans mise en forme : il suit alors la langue du CV. */
export function isDefaultSectionLabel(value: string): boolean {
  return stripHtml(value) === value && DEFAULT_LABELS.has(value.trim().toLowerCase());
}

/** Titre d'une section built-in : renommage de l'utilisateur, sinon libellé par
 *  défaut dans la langue du CV (et propre au CV canadien le cas échéant). */
export function builtInSectionTitle(cv: CVData, sectionId: string): string {
  const override = cv.layout?.sectionTitles?.[sectionId];
  if (override && !isDefaultSectionLabel(override)) return override;
  const labels = sectionLabels(cvLanguage(cv), isSingleColumn(cv));
  return labels[sectionId as SectionId] ?? override ?? sectionId;
}
