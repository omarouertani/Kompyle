import type { CVData, ATSMatchedKeyword } from "@/types/cv";

/**
 * Garde-fou DÉTERMINISTE des mots-clés ATS.
 *
 * Le LLM produit deux hallucinations contraires :
 *  - Faux positif (invention sémantique) : il "matche" un terme qui n'est PAS
 *    écrit dans le CV (ex: déduit "Node.js" de "NestJS").
 *  - Faux négatif (oubli textuel) : il classe "manquant" un terme pourtant
 *    littéralement présent (ex: "PostgreSQL" enfoui dans projects.stack).
 *
 * On ne peut pas faire confiance au modèle pour ça. On vérifie donc APRÈS
 * génération par correspondance de chaîne stricte contre le texte réel du CV :
 *  - tout matchedKeyword introuvable est SUPPRIMÉ ;
 *  - tout missingKeyword en réalité présent est BASCULÉ en matched.
 *
 * La correspondance est insensible à la casse mais respecte les frontières de
 * token (via lookarounds alphanumériques) : "Java" ne matche donc PAS
 * "JavaScript", contrairement à un simple String.includes().
 */

/** Un segment de texte du CV + le label de sa provenance (sert de foundInSection). */
interface CvSegment {
  label: string;
  text: string;
}

function push(segments: CvSegment[], label: string, text: string | undefined | null): void {
  const t = text?.trim();
  if (t) segments.push({ label, text: t });
}

/** Décompose le CV en segments de texte étiquetés, sans les champs non pertinents
 *  (photo, URLs, coordonnées) qui pourraient générer de faux appariements. */
function buildCvSegments(cvData: CVData): CvSegment[] {
  const segments: CvSegment[] = [];

  const pi = cvData.personalInfo;
  if (pi) {
    push(segments, "personalInfo.role", pi.role);
    push(segments, "personalInfo.techLine", pi.techLine);
    push(segments, "personalInfo.summary", pi.summary);
    push(segments, "personalInfo.certifications", pi.certifications);
    push(segments, "personalInfo.interests", pi.interests);
  }

  for (const group of cvData.skills ?? []) {
    const cat = group.category?.trim() || "Skills";
    push(segments, `skills.items (${cat})`, group.items);
  }

  for (const project of cvData.projects ?? []) {
    const title = project.title?.trim() || "project";
    push(segments, `projects.stack (${title})`, project.stack);
    push(segments, `projects.description (${title})`, project.description);
  }

  for (const exp of cvData.experiences ?? []) {
    const where = `${exp.title?.trim() || "role"}${exp.org ? ` @ ${exp.org.trim()}` : ""}`;
    push(segments, `experiences (${where})`, [exp.title, exp.org, ...(exp.bullets ?? [])].filter(Boolean).join(" · "));
  }

  for (const edu of cvData.education ?? []) {
    push(segments, "education", [edu.degree, edu.institution].filter(Boolean).join(" · "));
  }

  for (const section of cvData.customSections ?? []) {
    push(segments, `customSections (${section.title?.trim() || "section"})`, [section.title, section.content].filter(Boolean).join(" · "));
  }

  if (cvData.spokenLanguages?.length) {
    push(segments, "spokenLanguages", cvData.spokenLanguages.join(", "));
  }

  return segments;
}

/** Construit un matcher de token : la chaîne exacte, insensible à la casse, mais
 *  non incluse dans un mot plus large ("java" ne matche pas "javascript"). */
function buildTokenMatcher(term: string): RegExp | null {
  const cleaned = term.trim();
  if (!cleaned) return null;
  const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Lookarounds : pas d'alphanumérique collé de part et d'autre du terme.
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
}

/** Renvoie le label du premier segment contenant le terme, ou null si absent. */
function locate(term: string, segments: CvSegment[]): string | null {
  const matcher = buildTokenMatcher(term);
  if (!matcher) return null;
  for (const seg of segments) {
    if (matcher.test(seg.text)) return seg.label;
  }
  return null;
}

export interface ReconciledKeywords {
  matchedKeywords: ATSMatchedKeyword[];
  missingKeywords: string[];
  /** Mots-clés "matchés" par l'IA mais introuvables dans le CV (faux positifs supprimés). */
  removedFalsePositives: string[];
  /** Mots-clés "manquants" selon l'IA mais en réalité présents (faux négatifs récupérés). */
  recoveredFalseNegatives: string[];
}

/**
 * Réconcilie les listes de mots-clés produites par l'IA avec le texte réel du CV.
 * Déterministe : aucune déduction, uniquement de la correspondance de chaîne.
 */
export function reconcileAtsKeywords(
  matched: ATSMatchedKeyword[],
  missing: string[],
  cvData: CVData,
): ReconciledKeywords {
  const segments = buildCvSegments(cvData);

  const verifiedMatched: ATSMatchedKeyword[] = [];
  const removedFalsePositives: string[] = [];
  const recoveredFalseNegatives: string[] = [];
  const actuallyMissing: string[] = [];
  const seen = new Set<string>();

  const add = (term: string, foundInSection: string) => {
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    verifiedMatched.push({ term: term.trim(), foundInSection });
  };

  // 1) Faux positifs : on ne garde un "matched" que s'il est réellement écrit.
  for (const kw of matched ?? []) {
    const where = locate(kw.term, segments);
    if (where) add(kw.term, where); // on impose la provenance VÉRIFIÉE
    else removedFalsePositives.push(kw.term);
  }

  // 2) Faux négatifs : un "missing" présent dans le texte repasse en matched.
  for (const term of missing ?? []) {
    const where = locate(term, segments);
    if (where) {
      recoveredFalseNegatives.push(term);
      add(term, where);
    } else {
      actuallyMissing.push(term);
    }
  }

  return {
    matchedKeywords: verifiedMatched,
    missingKeywords: actuallyMissing,
    removedFalsePositives,
    recoveredFalseNegatives,
  };
}
