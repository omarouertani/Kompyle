import type { CVData } from "@/types/cv";

/** Titre d'une section dans le PDF : renommage utilisateur sinon libellé par défaut.
 *  Partagé par tous les templates PDF. */
export const sectionTitle = (data: CVData, id: string, fallback: string): string =>
  data.layout?.sectionTitles?.[id] ?? fallback;

/** Limites de la page A4 en points (PDF). */
export const A4_PAGE_WIDTH_PT = 595;
export const A4_PAGE_HEIGHT_PT = 842;

/** Un bloc positionné hors de la page A4 est ignoré au rendu PDF (sinon page
 *  blanche / boucle de pagination). Le canvas signale la limite à l'utilisateur. */
export const isBlockOutOfPage = (pos: { x: number; y: number }): boolean =>
  pos.y >= A4_PAGE_HEIGHT_PT || pos.x >= A4_PAGE_WIDTH_PT;
