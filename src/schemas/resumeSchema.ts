import { z } from "zod";
import type { CVData } from "@/types/cv";

/**
 * Schéma Zod du CV de Kompyle — calqué EXACTEMENT sur l'interface CVData
 * (src/types/cv.ts). Inspiré de l'approche de Reactive Resume (packages/schema) :
 * schémas composables + `.describe()` sur chaque champ (documentation ET, à
 * terme, injectable dans le prompt de l'IA pour un respect strict du format).
 *
 * Validation STRICTE des champs de contenu (on veut détecter si l'IA casse la
 * structure) ; les champs cosmétiques/métadonnées restent optionnels — ils sont
 * de toute façon ré-imposés depuis le CV original par la route /api/adapt-cv.
 */

export const personalInfoSchema = z.object({
  name: z.string().describe("Nom complet du candidat (immuable)."),
  role: z.string().describe("Intitulé de poste (immuable)."),
  techLine: z.string().describe("Ligne de mots-clés techniques (adaptable : réordonner/reformuler)."),
  email: z.string().describe("Email (immuable)."),
  phone: z.string().describe("Téléphone (immuable)."),
  location: z.string().describe("Localisation (immuable)."),
  linkedin: z.string().describe("LinkedIn (immuable)."),
  portfolio: z.string().optional().describe("Portfolio (immuable, optionnel)."),
  summary: z.string().describe("Résumé de profil (adaptable)."),
});

export const skillGroupSchema = z.object({
  id: z.string().optional(),
  category: z.string().describe("Catégorie de compétences (immuable)."),
  items: z.string().describe("Compétences séparées par des virgules (adaptable : réordonner/prioriser)."),
});

export const experienceSchema = z.object({
  id: z.string().optional(),
  forcePageBreak: z.boolean().optional(),
  customMarginBottom: z.number().optional(),
  title: z.string().describe("Intitulé du poste (immuable)."),
  org: z.string().describe("Organisation (immuable)."),
  date: z.string().describe("Période (immuable)."),
  bullets: z
    .array(z.string())
    .describe("Puces d'accomplissements (adaptable : reformuler — sans changer leur nombre)."),
});

export const projectSchema = z.object({
  id: z.string().optional(),
  forcePageBreak: z.boolean().optional(),
  customMarginBottom: z.number().optional(),
  title: z.string().describe("Titre du projet (immuable)."),
  description: z.string().describe("Description du projet (adaptable)."),
  stack: z.string().optional().describe("Stack technique (immuable, optionnel)."),
});

export const educationSchema = z.object({
  id: z.string().optional(),
  forcePageBreak: z.boolean().optional(),
  customMarginBottom: z.number().optional(),
  degree: z.string().describe("Diplôme (immuable)."),
  institution: z.string().describe("Établissement (immuable)."),
});

export const layoutPageSchema = z.object({
  main: z.array(z.string()),
  sidebar: z.array(z.string()),
});

export const cvLayoutSchema = z.object({
  sidebarWidth: z.number().optional(),
  pages: z.array(layoutPageSchema),
});

export const resumeSchema = z.object({
  personalInfo: personalInfoSchema,
  skills: z.array(skillGroupSchema).min(1, "Au moins un groupe de compétences est requis."),
  spokenLanguages: z.array(z.string()).describe("Langues parlées (immuable)."),
  education: z.array(educationSchema).min(1, "Au moins une formation est requise."),
  experiences: z.array(experienceSchema).min(1, "Au moins une expérience est requise."),
  projects: z.array(projectSchema),
  // Mise en page (sections/pages) — pilotée par l'utilisateur, jamais par l'IA.
  layout: cvLayoutSchema.optional(),
});

/** Type inféré du schéma — équivalent à CVData. */
export type ResumeSchema = z.infer<typeof resumeSchema>;

/**
 * Garde de synchronisation au compile-time : si CVData et le schéma Zod
 * divergent (champ ajouté/renommé/retypé d'un seul côté), ces lignes ne
 * compilent plus. Empêche toute dérive silencieuse entre types et validation.
 */
type _SchemaAssignableToCV = ResumeSchema extends CVData ? true : false;
type _CVAssignableToSchema = CVData extends ResumeSchema ? true : false;
const _assertSchemaInSync: [_SchemaAssignableToCV, _CVAssignableToSchema] = [true, true];
void _assertSchemaInSync;

/**
 * Formate les erreurs Zod en messages lisibles « chemin: message » pour les
 * renvoyer proprement dans la réponse de l'API.
 */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(racine)";
    return `${path}: ${issue.message}`;
  });
}
