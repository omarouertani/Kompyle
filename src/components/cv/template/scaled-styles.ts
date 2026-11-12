import type { CVTheme } from "@/types/cv";

/**
 * Styles PDF d'un bloc agrandi / réduit (`ElementPosition.fontScale`, réglé par
 * la poignée d'angle ou la taille de texte d'une sélection). Le canvas multiplie
 * la taille de base ET celle des titres par cette échelle (CanvasBlock) : on
 * reconstruit les styles du modèle de la même façon, un jeu par échelle.
 */
export function makeScaledStyles<S>(
  build: (theme: CVTheme) => S,
  theme: CVTheme | undefined,
  defaultFontSize: number,
  base: S,
): (scale?: number) => S {
  const cache = new Map<number, S>();
  return (scale?: number) => {
    if (!scale || scale === 1 || !Number.isFinite(scale)) return base;
    const hit = cache.get(scale);
    if (hit) return hit;
    const styles = build({
      ...theme,
      fontSize: (theme?.fontSize ?? defaultFontSize) * scale,
      headingSize: (theme?.headingSize ?? 12) * scale,
    });
    cache.set(scale, styles);
    return styles;
  };
}

/** Échelle de police portée par une position (absente = 1). */
export const scaleOf = (pos: unknown): number | undefined =>
  (pos as { fontScale?: number } | undefined)?.fontScale;
