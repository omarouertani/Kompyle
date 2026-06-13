/** Alignement intelligent type Canva/Figma : aimante un bloc en déplacement
 *  sur les bords / centres des autres blocs ET affiche les distances chiffrées
 *  vers les voisins. Coordonnées en points PDF. */

export const SNAP_THRESHOLD = 5;
export const A4_WIDTH_PT = 595;
/** Au-delà de cette distance, on n'affiche plus de cote chiffrée (bruit visuel). */
const MAX_DISTANCE_PT = 160;

export type BlockPos = {
  x: number;
  y: number;
  w?: number;
  h?: number;
  page?: number;
  /** Échelle de police appliquée au contenu (resize diagonal). */
  fontScale?: number;
  /** Bloc verrouillé : ni drag ni resize. */
  locked?: boolean;
  /** Identifiant de groupe : les blocs partageant un groupId se déplacent et
   *  se sélectionnent ensemble (Ctrl+G pour grouper). */
  groupId?: string;
};

/** Rectangle plein (avec hauteur résolue) utilisé pour la géométrie du snap. */
export interface SnapRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SnapGuide {
  /** Direction de la LIGNE tracée. */
  orientation: "vertical" | "horizontal";
  /** "align" = ligne d'alignement de bord/centre ; "distance" = cote chiffrée. */
  kind: "align" | "distance";
  /** Coordonnée de la ligne sur son axe principal (pt).
   *  vertical → x ; horizontal → y. */
  position: number;
  /** Étendue de la ligne sur l'axe perpendiculaire (pt). */
  start: number;
  end: number;
  /** Valeur affichée (distance en pt) pour les cotes. */
  label?: string;
}

const EPS = 0.6;

/**
 * Calcule les guides de snap + la position aimantée d'un bloc en déplacement.
 *
 * - Aligne les bords (gauche/droite/haut/bas) ET les centres (X et Y).
 * - Trace une ligne d'alignement couvrant l'union des deux blocs concernés.
 * - Ajoute des COTES CHIFFRÉES vers le voisin le plus proche dans chaque
 *   direction (haut, bas, gauche, droite) lorsqu'il y a recouvrement sur
 *   l'axe perpendiculaire — exactement comme Figma/Canva.
 */
export function findSnapGuides(
  drag: SnapRect,
  candidates: SnapRect[]
): { guides: SnapGuide[]; snappedX: number; snappedY: number } {
  let snappedX = drag.x;
  let snappedY = drag.y;
  let bestDx = SNAP_THRESHOLD + 1;
  let bestDy = SNAP_THRESHOLD + 1;

  const dxEdges = [drag.x, drag.x + drag.w / 2, drag.x + drag.w];
  const dyEdges = [drag.y, drag.y + drag.h / 2, drag.y + drag.h];

  // ── 1. Détermine le meilleur aimant sur X et sur Y ───────────────────────
  for (const c of candidates) {
    if (c.id === drag.id) continue;
    const cxEdges = [c.x, c.x + c.w / 2, c.x + c.w];
    for (const ct of cxEdges) {
      for (const dv of dxEdges) {
        const dist = Math.abs(dv - ct);
        if (dist < SNAP_THRESHOLD && dist < bestDx) {
          bestDx = dist;
          snappedX = drag.x + (ct - dv);
        }
      }
    }
    const cyEdges = [c.y, c.y + c.h / 2, c.y + c.h];
    for (const ct of cyEdges) {
      for (const dv of dyEdges) {
        const dist = Math.abs(dv - ct);
        if (dist < SNAP_THRESHOLD && dist < bestDy) {
          bestDy = dist;
          snappedY = drag.y + (ct - dv);
        }
      }
    }
  }

  // Bloc aimanté (sert de base aux lignes d'alignement et aux cotes).
  const s = {
    xL: snappedX,
    xC: snappedX + drag.w / 2,
    xR: snappedX + drag.w,
    yT: snappedY,
    yC: snappedY + drag.h / 2,
    yB: snappedY + drag.h,
  };

  const guides: SnapGuide[] = [];
  const seen = new Set<string>();
  const pushUnique = (g: SnapGuide) => {
    const key = `${g.orientation}:${g.kind}:${Math.round(g.position)}:${Math.round(g.start)}:${Math.round(g.end)}`;
    if (seen.has(key)) return;
    seen.add(key);
    guides.push(g);
  };

  // ── 2. Lignes d'alignement (bords + centres alignés) ─────────────────────
  for (const c of candidates) {
    if (c.id === drag.id) continue;
    const cxEdges = [c.x, c.x + c.w / 2, c.x + c.w];
    for (const ct of cxEdges) {
      if (Math.abs(s.xL - ct) < EPS || Math.abs(s.xC - ct) < EPS || Math.abs(s.xR - ct) < EPS) {
        pushUnique({
          orientation: "vertical",
          kind: "align",
          position: ct,
          start: Math.min(s.yT, c.y),
          end: Math.max(s.yB, c.y + c.h),
        });
      }
    }
    const cyEdges = [c.y, c.y + c.h / 2, c.y + c.h];
    for (const ct of cyEdges) {
      if (Math.abs(s.yT - ct) < EPS || Math.abs(s.yC - ct) < EPS || Math.abs(s.yB - ct) < EPS) {
        pushUnique({
          orientation: "horizontal",
          kind: "align",
          position: ct,
          start: Math.min(s.xL, c.x),
          end: Math.max(s.xR, c.x + c.w),
        });
      }
    }
  }

  // ── 3. Cotes chiffrées vers le voisin le plus proche dans chaque sens ─────
  const xOverlap = (c: SnapRect) => Math.max(s.xL, c.x) < Math.min(s.xR, c.x + c.w);
  const yOverlap = (c: SnapRect) => Math.max(s.yT, c.y) < Math.min(s.yB, c.y + c.h);

  let above: { c: SnapRect; gap: number } | null = null;
  let below: { c: SnapRect; gap: number } | null = null;
  let left: { c: SnapRect; gap: number } | null = null;
  let right: { c: SnapRect; gap: number } | null = null;

  for (const c of candidates) {
    if (c.id === drag.id) continue;
    if (xOverlap(c)) {
      const cBottom = c.y + c.h;
      if (cBottom <= s.yT + EPS) {
        const gap = s.yT - cBottom;
        if (gap >= 0 && (!above || gap < above.gap)) above = { c, gap };
      }
      if (c.y >= s.yB - EPS) {
        const gap = c.y - s.yB;
        if (gap >= 0 && (!below || gap < below.gap)) below = { c, gap };
      }
    }
    if (yOverlap(c)) {
      const cRight = c.x + c.w;
      if (cRight <= s.xL + EPS) {
        const gap = s.xL - cRight;
        if (gap >= 0 && (!left || gap < left.gap)) left = { c, gap };
      }
      if (c.x >= s.xR - EPS) {
        const gap = c.x - s.xR;
        if (gap >= 0 && (!right || gap < right.gap)) right = { c, gap };
      }
    }
  }

  const vGap = (n: { c: SnapRect; gap: number }, fromY: number, toY: number) => {
    if (n.gap > MAX_DISTANCE_PT) return;
    const cx = (Math.max(s.xL, n.c.x) + Math.min(s.xR, n.c.x + n.c.w)) / 2;
    pushUnique({
      orientation: "vertical",
      kind: "distance",
      position: cx,
      start: Math.min(fromY, toY),
      end: Math.max(fromY, toY),
      label: String(Math.round(n.gap)),
    });
  };
  const hGap = (n: { c: SnapRect; gap: number }, fromX: number, toX: number) => {
    if (n.gap > MAX_DISTANCE_PT) return;
    const cy = (Math.max(s.yT, n.c.y) + Math.min(s.yB, n.c.y + n.c.h)) / 2;
    pushUnique({
      orientation: "horizontal",
      kind: "distance",
      position: cy,
      start: Math.min(fromX, toX),
      end: Math.max(fromX, toX),
      label: String(Math.round(n.gap)),
    });
  };

  if (above) vGap(above, above.c.y + above.c.h, s.yT);
  if (below) vGap(below, s.yB, below.c.y);
  if (left) hGap(left, left.c.x + left.c.w, s.xL);
  if (right) hGap(right, s.xR, right.c.x);

  return { guides, snappedX, snappedY };
}
