import type { Style } from "@react-pdf/types";

/**
 * Style composition helpers — adaptés de Reactive Resume (packages/pdf).
 *
 * Idée centrale : au lieu de styles monolithiques, on EMPILE des couches de
 * styles et on les aplatit en tableau. L'ordre = la priorité (le dernier gagne).
 * Cela permet d'avoir des défauts globaux surchargeables localement, proprement.
 */

export type StyleInput = Style | Style[] | null | undefined;

/**
 * Aplatit une liste de styles (objets, tableaux, null/undefined) en un seul
 * tableau de Style, en filtrant les valeurs vides. react-pdf accepte un
 * tableau de styles et applique les propriétés de gauche à droite.
 */
export const composeStyles = (...styles: StyleInput[]): Style[] =>
  styles.flatMap((style) => {
    if (!style) return [];
    if (Array.isArray(style)) return style.filter(Boolean) as Style[];
    return [style];
  });

const linkUnderline = { textDecoration: "underline" } satisfies Style;
const linkNoUnderline = { textDecoration: "none" } satisfies Style;

/**
 * Comme composeStyles, mais ajoute la décoration de lien EN DERNIER pour
 * qu'elle gagne toujours sur les styles utilisateur. Par défaut sans soulignage
 * (cohérent avec le design des liens de contact de Kompyle).
 */
export const composeLinkStyles = (
  { hideUnderline = true }: { hideUnderline?: boolean } = {},
  ...styles: StyleInput[]
): Style[] =>
  composeStyles(...styles, hideUnderline ? linkNoUnderline : linkUnderline);

/**
 * safeTextStyle — LE correctif anti-bug de react-pdf.
 *
 * Appliqué EN DERNIER sur chaque primitive textuelle. Empêche qu'un mot/URL
 * non sécable déborde son conteneur flex (un flex-item a `minWidth: auto` par
 * défaut et refuse de rétrécir → débordement, casse de layout, voire pages
 * blanches). `minWidth: 0` + `flexShrink: 1` autorisent le rétrécissement,
 * `maxWidth: 100%` plafonne, `overflow: hidden` rogne le résidu éventuel.
 */
export const safeTextStyle = {
  minWidth: 0,
  maxWidth: "100%",
  flexShrink: 1,
  overflow: "hidden",
} satisfies Style;

/**
 * Avec `overflow: hidden`, un lineHeight trop serré rogne les jambages
 * (g, p, y, j). Valeur plancher sûre pour les gros titres (cf. RR : 1.3).
 */
export const headingSafeLineHeight = 1.3;
