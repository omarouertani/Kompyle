import type { CVData, SectionId } from "@/types/cv";
import { ALL_SECTION_IDS, getParentSectionId } from "@/lib/cv-layout";

/** Un bloc appartient-il à une section masquable (built-in ou custom) ? */
export function isSectionBlock(blockId: string): boolean {
  const parent = getParentSectionId(blockId);
  return ALL_SECTION_IDS.includes(parent as SectionId) || parent.startsWith("custom_");
}

/** Ids des blocs de l'en-tête (page 1). La photo n'apparaît que si une photo
 *  est définie ou si le template moderne (Chaima) l'impose. */
export function getHeaderBlockIds(data: CVData, isChaima: boolean): string[] {
  return [
    ...(data.personalInfo.photo || isChaima ? ["photo"] : []),
    "name",
    "role",
    "techLine",
  ];
}
