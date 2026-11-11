import { CV_ICON_NODES, type CvIconNode } from "./cv-icons-data";

/** Icônes proposées dans le menu Insérer (ordre d'affichage de la grille). */
export type CvIconName = keyof typeof CV_ICON_NODES;
export const CV_ICON_NAMES = Object.keys(CV_ICON_NODES) as CvIconName[];
export const DEFAULT_CV_ICON: CvIconName = "star";

/** Grille de dessin des icônes lucide (viewBox 0 0 24 24). */
export const CV_ICON_VIEWBOX = 24;
/** Épaisseurs de trait proposées, en unités de la grille (lucide : 2). */
export const CV_ICON_STROKES = [1, 1.5, 2, 2.5, 3];

export const isCvIconName = (name?: string): name is CvIconName => !!name && Object.hasOwn(CV_ICON_NODES, name);

/** Tracés d'une icône ; une icône inconnue (données anciennes / modifiées) donne `undefined`. */
export function cvIconNode(name?: string): CvIconNode | undefined {
  return isCvIconName(name) ? CV_ICON_NODES[name] : undefined;
}
