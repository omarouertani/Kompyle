import type { CVLayout, ElementPosition, FreeElement, FreeElementKind } from "@/types/cv";

/** Préfixe des ids d'éléments libres (clé dans `absolutePositions`). */
export const FREE_PREFIX = "free_";

export const isFreeElementId = (id: string): boolean => id.startsWith(FREE_PREFIX);

/** Taille et style de départ de chaque type d'élément (en pt). */
const DEFAULTS: Record<FreeElementKind, Omit<FreeElement, "id" | "kind" | "page" | "x" | "y">> = {
  text: { w: 180, h: 20, html: "" },
  line: { w: 200, h: 6, strokeWidth: 1.5 },
  rect: { w: 140, h: 70, fill: "#f4f4f5", strokeWidth: 1, radius: 4 },
};

/** Nouvel élément centré horizontalement sur la page, en haut de la zone
 *  visible (`y`). `accent` colore le trait / le texte. */
export function createFreeElement(
  kind: FreeElementKind,
  page: number,
  pageWidthPt: number,
  y: number,
  accent: string,
): FreeElement {
  const base = DEFAULTS[kind];
  const id = `${FREE_PREFIX}${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
  return {
    id,
    kind,
    page,
    x: Math.round((pageWidthPt - base.w) / 2),
    y: Math.round(y),
    ...base,
    color: kind === "text" ? undefined : accent,
  };
}

/** Position courante d'un élément : celle d'`absolutePositions` si elle existe,
 *  sinon sa position de création. */
export function freeElementPos(el: FreeElement, saved?: Record<string, ElementPosition>): ElementPosition {
  const p = saved?.[el.id];
  return p ? { ...p, page: p.page ?? 0 } : { x: el.x, y: el.y, w: el.w, h: el.h, page: el.page };
}

/** Éléments libres d'une page, avec leur position courante. */
export function freeElementsOnPage(layout: CVLayout, pageIndex: number): Array<{ el: FreeElement; pos: ElementPosition }> {
  return (layout.freeElements ?? [])
    .map((el) => ({ el, pos: freeElementPos(el, layout.absolutePositions) }))
    .filter(({ pos }) => (pos.page ?? 0) === pageIndex);
}

/** Positions des éléments libres seules (à conserver quand on recalcule ou
 *  vide les positions des sections). */
export function freePositionsOf(layout: CVLayout): Record<string, ElementPosition> {
  const out: Record<string, ElementPosition> = {};
  for (const el of layout.freeElements ?? []) out[el.id] = freeElementPos(el, layout.absolutePositions);
  return out;
}

/** Une ligne plus haute que large est verticale. */
export const isVerticalLine = (w: number, h: number): boolean => h > w;

/** Éléments libres avec leur position courante recopiée dans l'élément, à
 *  appeler avant d'effacer `absolutePositions` (changement de modèle). */
export function bakeFreeElementPositions(layout: CVLayout): FreeElement[] | undefined {
  if (!layout.freeElements?.length) return layout.freeElements;
  return layout.freeElements.map((el) => {
    const p = freeElementPos(el, layout.absolutePositions);
    return { ...el, x: p.x, y: p.y, w: p.w ?? el.w, h: p.h ?? el.h, page: p.page ?? 0 };
  });
}
