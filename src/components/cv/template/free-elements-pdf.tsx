import React from "react";
import { View, Text } from "@/components/pdf-primitives";
import type { CVLayout } from "@/types/cv";
import { freeElementsOnPage, isVerticalLine } from "@/lib/free-elements";

/**
 * Éléments libres d'une page, pour les templates PDF. Rendus en dernier dans
 * la <Page> : ils passent au-dessus des sections, comme dans le canvas.
 * Les coordonnées sont celles de la page (pt), identiques au canvas.
 */
export function renderFreeElementsPdf(layout: CVLayout, pageIndex: number, defaultFontSize = 10) {
  const theme = layout.theme ?? {};
  const textStyle = {
    fontSize: theme.fontSize ?? defaultFontSize,
    color: theme.textColor || "#27272a",
    lineHeight: theme.lineHeight ?? 1.15,
  };
  return freeElementsOnPage(layout, pageIndex).map(({ el, pos }) => {
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
  });
}
