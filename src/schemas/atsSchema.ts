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

export const atsReportSchema = z.object({
  overallScore: z.number().int().min(0).max(100).describe("Score ATS global du CV face à l'offre (0-100)."),
  scoreLabel: z.string().min(1).describe("Libellé court dans la langue de l'offre : 'Excellent', 'Bon', 'À améliorer', 'Faible'."),
  summary: z.string().min(1).describe("Verdict en 1-2 phrases, dans la langue de l'offre."),
  subScores: atsSubScoresSchema,
  matchedKeywords: z.array(z.string().min(1)).describe("Mots-clés/compétences de l'offre TROUVÉS dans le CV (forme exacte de l'offre)."),
  missingKeywords: z.array(z.string().min(1)).describe("Mots-clés/compétences explicitement demandés par l'offre et ABSENTS du CV."),
  sectionFeedback: z.array(atsSectionFeedbackSchema).min(1).describe("Une ligne par section pertinente du CV."),
  strengths: z.array(z.string().min(1)).describe("Points forts du candidat pour cette offre (phrases courtes)."),
  recommendations: z.array(z.string().min(1)).describe("Actions concrètes et atomiques à appliquer au CV pour grimper en score (impératif)."),
});

export type ATSReportParsed = z.infer<typeof atsReportSchema>;
