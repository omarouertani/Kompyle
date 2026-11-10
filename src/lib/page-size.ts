// Formats de page pris en charge, en points PDF (72 dpi). Source UNIQUE pour le
// canvas (dimensions, pagination, magnétisme) et les templates PDF (<Page size>).
// A4 = Europe ; Letter = Amérique du Nord (CV canadiens / américains).

export type PageSizeId = "A4" | "LETTER";

export interface PageDims {
  id: PageSizeId;
  widthPt: number;
  heightPt: number;
}

export const PAGE_SIZES: Record<PageSizeId, PageDims> = {
  A4: { id: "A4", widthPt: 595.28, heightPt: 841.89 },
  LETTER: { id: "LETTER", widthPt: 612, heightPt: 792 },
};

export const DEFAULT_PAGE_SIZE: PageSizeId = "A4";

/** Dimensions de la page d'un CV (A4 par défaut, valeur inconnue → A4). */
export function getPageDims(layout?: { pageSize?: PageSizeId } | null): PageDims {
  return PAGE_SIZES[layout?.pageSize ?? DEFAULT_PAGE_SIZE] ?? PAGE_SIZES[DEFAULT_PAGE_SIZE];
}

/** Marge basse réservée en bas de page (pt), partagée par la pagination. */
export const PAGE_BOTTOM_MARGIN_PT = 24;
