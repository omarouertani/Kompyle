/** Alignement intelligent type Canva : aimante un bloc en déplacement
 *  sur les bords / centres des autres blocs. Coordonnées en points PDF. */

export const SNAP_THRESHOLD = 5;
export const A4_WIDTH_PT = 595;

export interface SnapGuide {
  orientation: "horizontal" | "vertical";
  position: number;
}

export type BlockPos = { x: number; y: number; w?: number; h?: number };

export function findSnapGuides(
  dragId: string,
  dragX: number,
  dragY: number,
  dragW: number,
  allPositions: Record<string, BlockPos>
): { guides: SnapGuide[]; snappedX: number; snappedY: number } {
  const guides: SnapGuide[] = [];
  let snappedX = dragX;
  let snappedY = dragY;
  const dragRight = dragX + dragW;
  const dragCenterX = dragX + dragW / 2;

  let bestDx = SNAP_THRESHOLD + 1;
  let bestDy = SNAP_THRESHOLD + 1;

  for (const [id, pos] of Object.entries(allPositions)) {
    if (id === dragId) continue;
    const pw = pos.w ?? 150;

    const xTargets = [
      { src: dragX, target: pos.x },
      { src: dragRight, target: pos.x + pw },
      { src: dragX, target: pos.x + pw },
      { src: dragRight, target: pos.x },
      { src: dragCenterX, target: pos.x + pw / 2 },
    ];
    for (const { src, target } of xTargets) {
      const dist = Math.abs(src - target);
      if (dist < SNAP_THRESHOLD && dist < bestDx) {
        bestDx = dist;
        snappedX = dragX + (target - src);
        guides.push({ orientation: "vertical", position: target });
      }
    }

    const dyDist = Math.abs(dragY - pos.y);
    if (dyDist < SNAP_THRESHOLD && dyDist < bestDy) {
      bestDy = dyDist;
      snappedY = pos.y;
      guides.push({ orientation: "horizontal", position: pos.y });
    }
  }

  return { guides: guides.slice(-4), snappedX, snappedY };
}
