import React from "react";
import { View, Text } from "@/components/pdf-primitives";
import type { CVLayout, ElementPosition, FreeElement } from "@/types/cv";
import { freeElementsOnPage, isVerticalLine } from "@/lib/free-elements";
import { sortByZ } from "@/lib/z-order";

type TextStyle = { fontSize: number; color: string; lineHeight: number };

function freeTextStyle(layout: CVLayout, defaultFontSize: number): TextStyle {
  const theme = layout.theme ?? {};
  return {
    fontSize: theme.fontSize ?? defaultFontSize,
    color: theme.textColor || "#27272a",
    lineHeight: theme.lineHeight ?? 1.15,
  };
}

/** Un élément libre (coordonnées de la page en pt, identiques au canvas). */
function renderFreeElementPdf(el: FreeElement, pos: ElementPosition, textStyle: TextStyle): React.ReactNode {
  const w = pos.w ?? el.w;
  const h = pos.h ?? el.h;
  const box = { position: "absolute" as const, left: pos.x, top: pos.y, width: w };

  if (el.kind === "line") {
    const t = Math.max(0.25, el.strokeWidth ?? 1.5);
    const color = el.color ?? "#1a1a1a";
    // Le trait est centré dans la boîte, sur son grand axe.
    return isVerticalLine(w, h) ? (
      <View key={el.id} style={{ ...box, height: h }}>
        <View style={{ position: "absolute", left: (w - t) / 2, top: 0, width: t, height: h, backgroundColor: color }} />
      </View>
    ) : (
      <View key={el.id} style={{ ...box, height: h }}>
        <View style={{ position: "absolute", left: 0, top: (h - t) / 2, width: w, height: t, backgroundColor: color }} />
      </View>
    );
  }

  if (el.kind === "rect") {
    const sw = el.strokeWidth ?? 0;
    return (
      <View
        key={el.id}
        style={{
          ...box,
          height: h,
          backgroundColor: el.fill && el.fill !== "transparent" ? el.fill : undefined,
          borderRadius: el.radius ?? 0,
          ...(sw > 0 ? { borderWidth: sw, borderColor: el.color ?? "#1a1a1a", borderStyle: "solid" as const } : {}),
        }}
      />
    );
  }

  if (!el.html) return null;
  return (
    <View key={el.id} style={{ ...box, minHeight: h, textAlign: pos.align ?? "left" }}>
      <Text style={{ fontSize: textStyle.fontSize * (pos.fontScale ?? 1), color: el.color ?? textStyle.color, lineHeight: textStyle.lineHeight }}>
        {el.html}
      </Text>
    </View>
  );
}

/**
 * Éléments libres visibles d'une page, indexés par id (mode absolu : le
 * template les mélange aux sections selon l'ordre de superposition).
 */
export function freeElementNodesPdf(layout: CVLayout, pageIndex: number, defaultFontSize = 10): Record<string, React.ReactNode> {
  const textStyle = freeTextStyle(layout, defaultFontSize);
  const out: Record<string, React.ReactNode> = {};
  for (const { el, pos } of freeElementsOnPage(layout, pageIndex)) {
    if (!pos.hidden) out[el.id] = renderFreeElementPdf(el, pos, textStyle);
  }
  return out;
}

/**
 * Mode flux : éléments libres d'une page rendus en dernier dans la <Page>, au-
 * dessus du contenu, dans leur ordre de superposition entre eux.
 */
export function renderFreeElementsPdf(layout: CVLayout, pageIndex: number, defaultFontSize = 10) {
  const nodes = freeElementNodesPdf(layout, pageIndex, defaultFontSize);
  const ids = freeElementsOnPage(layout, pageIndex).map(({ el }) => el.id);
  const posOf = Object.fromEntries(freeElementsOnPage(layout, pageIndex).map(({ el, pos }) => [el.id, pos]));
  return sortByZ(ids, (id) => posOf[id]).map((id) => nodes[id]);
}

/**
 * Mode absolu : rend les blocs de la page (en-tête, sections, éléments libres)
 * dans l'ordre de superposition, du fond vers l'avant — le PDF peint dans
 * l'ordre du document, comme le canvas empile par z-index. Les blocs masqués
 * (panneau de calques) sont omis.
 */
export function renderStackedPdf(
  layout: CVLayout,
  pageIndex: number,
  orderedIds: string[],
  renderBlock: (id: string) => React.ReactNode,
  defaultFontSize = 10,
): React.ReactNode[] {
  const free = freeElementNodesPdf(layout, pageIndex, defaultFontSize);
  const freePos = Object.fromEntries(freeElementsOnPage(layout, pageIndex).map(({ el, pos }) => [el.id, pos]));
  const saved = layout.absolutePositions ?? {};
  const ids = [...orderedIds, ...Object.keys(freePos)];
  const getPos = (id: string) => freePos[id] ?? saved[id];
  return sortByZ(ids, getPos)
    .filter((id) => !getPos(id)?.hidden)
    .map((id) => (id in freePos ? free[id] : <React.Fragment key={id}>{renderBlock(id)}</React.Fragment>));
}
