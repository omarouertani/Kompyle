import type { CVTheme, PhotoShape } from "@/types/cv";

/** Cadre de la photo de profil, partagé par le canvas (CSS) et le PDF
 *  (react-pdf) pour un rendu identique. Valeurs en points. */
export interface PhotoFrame {
  shape: PhotoShape;
  /** Rayon des coins en pt pour une photo de `sizePt` de côté. */
  radius: number;
  borderWidth: number;
  borderColor: string;
}

export const PHOTO_SHAPES: PhotoShape[] = ["circle", "rounded", "square"];
export const PHOTO_BORDER_WIDTHS = [0, 1, 1.5, 2, 3];
/** Épaisseur par défaut = rendu historique du template Moderne. */
export const DEFAULT_PHOTO_BORDER_WIDTH = 1.5;

export function photoFrame(theme: CVTheme | undefined, sizePt: number, fallbackColor: string): PhotoFrame {
  const shape: PhotoShape = theme?.photoShape ?? "circle";
  const radius = shape === "circle" ? sizePt / 2 : shape === "rounded" ? Math.round(sizePt * 0.16) : 0;
  const borderWidth = theme?.photoBorderWidth ?? DEFAULT_PHOTO_BORDER_WIDTH;
  const borderColor = theme?.photoBorderColor || theme?.primaryColor || fallbackColor;
  return { shape, radius, borderWidth, borderColor };
}
