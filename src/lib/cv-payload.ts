import type { CVData } from "@/types/cv";

/**
 * Prépare un CV avant de l'envoyer à l'IA dans un prompt.
 *
 * On retire :
 *  - `layout` : piloté par l'utilisateur, sans intérêt analytique pour l'IA ;
 *  - `personalInfo.photo` : image (Base64 ou URL) potentiellement volumineuse qui
 *    gonflerait inutilement le contexte. L'IA n'en a aucun besoin, et les routes qui
 *    renvoient un CV ré-attachent la photo d'origine côté sortie.
 *
 * Ne mute pas l'entrée : renvoie une copie superficielle adaptée au prompt.
 */
export function cvForAiPrompt(cvData: CVData): Omit<CVData, "layout"> {
  const { layout: _layout, personalInfo, ...rest } = cvData;
  const { photo: _photo, ...personalInfoNoPhoto } = personalInfo;
  return { ...rest, personalInfo: personalInfoNoPhoto };
}
