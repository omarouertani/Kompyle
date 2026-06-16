import { z } from "zod";

/**
 * Schéma du rapport ATS — sortie stricte de /api/ats-check.
 * Inspiré du pipeline d'extraction/validation déjà utilisé par adapt-cv :
 * l'IA renvoie un JSON, on l'isole, le répare, et on valide ici.
 */

export const atsSectionStatusSchema = z.enum(["good", "warning", "missing"]);

export const atsSectionFeedbackSchema = z.object({
  section: z.string().min(1).describe("Nom de la section du CV (Résumé, Expérience, Compétences, Projets, Formation, ...)."),
  status: atsSectionStatusSchema.describe("État : good = couvre bien l'offre, warning = partiel, missing = absent ou inadéquat."),
  feedback: z.string().min(1).describe("Phrase courte expliquant CE QUI manque ou doit être renforcé dans cette section vis-à-vis de l'offre."),
});

export const atsSubScoresSchema = z.object({
  keywords: z.number().int().min(0).max(100),
  skills: z.number().int().min(0).max(100),
  experience: z.number().int().min(0).max(100),
  formatting: z.number().int().min(0).max(100),
});

/**
 * Mot-clé TROUVÉ dans le CV — avec preuve contextuelle obligatoire.
 *
 * Forcer le couple { term, foundInSection } impose un "chain of thought" :
 * l'IA ne peut pas se contenter de recracher un terme, elle DOIT prouver où
 * elle l'a vu dans le JSON. Cela l'oblige à scanner activement les tableaux
 * imbriqués (skills.items, projects.stack, experiences.bullets…) avant de
 * conclure, ce qui élimine les faux négatifs du syndrome "Lost in the Middle".
 */
export const atsMatchedKeywordSchema = z.object({
  term: z.string().min(1).describe("Le mot-clé/compétence de l'offre trouvé dans le CV (forme exacte de l'offre)."),
  foundInSection: z
    .string()
    .min(1)
    .describe(
      "PREUVE : où exactement ce terme apparaît dans le CV. Cite le chemin précis, ex: 'skills.items (catégorie Backend)', 'projects.stack (projet X)', 'experiences.bullets (poste Y)', 'personalInfo.techLine', 'personalInfo.summary'.",
    ),
});

export const atsReportSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe("Score ATS global du CV face à l'offre (0-100)."),
  scoreLabel: z.string().min(1).describe("Libellé court dans la langue de l'offre : 'Excellent', 'Bon', 'À améliorer', 'Faible'."),
  summary: z.string().min(1).describe("Verdict en 1-2 phrases, dans la langue de l'offre."),
  subScores: atsSubScoresSchema,
  matchedKeywords: z
    .array(atsMatchedKeywordSchema)
    .describe(
      "Mots-clés/compétences de l'offre TROUVÉS dans le CV. Chaque entrée DOIT inclure foundInSection prouvant l'emplacement exact dans le JSON (scan exhaustif des tableaux imbriqués obligatoire).",
    ),
  missingKeywords: z.array(z.string().min(1)).describe("Mots-clés/compétences explicitement demandés par l'offre et RÉELLEMENT ABSENTS du CV — uniquement après avoir scanné TOUTES les sections, y compris skills.items, projects.stack et experiences.bullets."),
  sectionFeedback: z.array(atsSectionFeedbackSchema).min(1).describe("Une ligne par section pertinente du CV."),
  strengths: z.array(z.string().min(1)).describe("Points forts du candidat pour cette offre (phrases courtes)."),
  recommendations: z.array(z.string().min(1)).describe("Actions concrètes et atomiques à appliquer au CV pour grimper en score (impératif)."),
});

export type ATSReportParsed = z.infer<typeof atsReportSchema>;
