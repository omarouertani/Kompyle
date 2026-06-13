import type { CVData, SectionId } from "@/types/cv";
import { ALL_SECTION_IDS, getParentSectionId, isCanadianTemplate, isModernTemplate } from "@/lib/cv-layout";

/** Un bloc appartient-il à une section masquable (built-in ou custom) ? */
export function isSectionBlock(blockId: string): boolean {
  const parent = getParentSectionId(blockId);
  return ALL_SECTION_IDS.includes(parent as SectionId) || parent.startsWith("custom_");
}

/** Ids des blocs de l'en-tête (page 1).
 *  - Canadien : nom + titre + ligne de coordonnées, jamais de photo (ATS).
 *  - Moderne / Classique : photo (si définie ou imposée) + nom + titre + techLine. */
export function getHeaderBlockIds(data: CVData, template: string): string[] {
  if (isCanadianTemplate(template)) {
    return ["name", "role", "contactLine"];
  }
  const isChaima = isModernTemplate(template);
  return [
    ...(data.personalInfo.photo || isChaima ? ["photo"] : []),
    "name",
    "role",
    "techLine",
  ];
}
