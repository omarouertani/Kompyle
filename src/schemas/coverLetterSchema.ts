import { z } from "zod";
import type { CoverLetterData } from "@/types/cv";

/**
 * Schéma Zod de la lettre de motivation — calqué EXACTEMENT sur l'interface
 * CoverLetterData (src/types/cv.ts). Même philosophie que resumeSchema :
 * validation STRICTE de la sortie LLM + `.describe()` injectables dans le
 * prompt pour un respect strict du format.
 */
export const coverLetterSchema = z.object({
  recipientName: z
    .string()
    .describe("Nom du contact recruteur. VIDE (\"\") si absent de l'offre — ne jamais inventer."),
  recipientCompany: z
    .string()
    .describe("Nom de l'entreprise cible. VIDE (\"\") si absent de l'offre — ne jamais inventer."),
  recipientAddress: z
    .string()
    .describe("Adresse de l'entreprise. VIDE (\"\") si absente de l'offre — ne jamais inventer."),
  date: z.string().describe("Date du jour, format lisible dans la langue de la lettre."),
  subject: z.string().min(1).describe("Objet clair (ex : « Candidature pour le poste de… »)."),
  salutation: z.string().min(1).describe("Salutation d'ouverture (ex : « Madame, Monsieur, »)."),
  paragraphs: z
    .array(z.string().min(1))
    .min(1, "Au moins un paragraphe est requis.")
    .max(6, "Au plus 6 paragraphes.")
    .describe("Corps de la lettre : idéalement 4 paragraphes (accroche, adéquation, projection, conclusion)."),
  signOff: z.string().min(1).describe("Formule de politesse finale (ex : « Cordialement, »)."),
});

export type CoverLetterSchema = z.infer<typeof coverLetterSchema>;

// Garde de synchronisation au compile-time avec CoverLetterData (même
// mécanisme que resumeSchema ↔ CVData).
type _SchemaAssignableToData = CoverLetterSchema extends CoverLetterData ? true : false;
type _DataAssignableToSchema = CoverLetterData extends CoverLetterSchema ? true : false;
const _assertSchemaInSync: [_SchemaAssignableToData, _DataAssignableToSchema] = [true, true];
void _assertSchemaInSync;
