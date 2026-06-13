"use client";

import { useCallback } from "react";
import type { CVData, CVLayout } from "@/types/cv";
import type { BlockPos } from "./snap";
import type { AlignKind } from "./MultiSelectToolbar";

interface UseAlignmentArgs {
  selectedIds: string[];
  layout: CVLayout;
  data: CVData;
  onChange: (newData: CVData) => void;
  defaultPositions: Record<string, BlockPos>;
  measureHeightPt: (blockId: string) => number | null;
}

/** Alignement / distribution de la multi-sélection (toolbar flottante).
 *  Les blocs verrouillés sont ignorés. */
export function useAlignment({ selectedIds, layout, data, onChange, defaultPositions, measureHeightPt }: UseAlignmentArgs) {
  const alignSelected = useCallback(
    (kind: AlignKind) => {
      if (selectedIds.length < 2) return;
      const positions: Record<string, BlockPos> = { ...defaultPositions, ...(layout.absolutePositions ?? {}) };
      const rects = selectedIds
        .map((id) => {
          const p = positions[id] ?? defaultPositions[id];
          if (!p || p.locked) return null;
          const w = p.w ?? 150;
          const h = p.h ?? measureHeightPt(id) ?? 20;
          return { id, x: p.x, y: p.y, w, h, p };
        })
        .filter((r): r is { id: string; x: number; y: number; w: number; h: number; p: BlockPos } => r !== null);
      if (rects.length < 2) return;

      const updates: Record<string, BlockPos> = {};
      const setX = (id: string, p: BlockPos, x: number) => (updates[id] = { ...p, x: Math.round(Math.max(0, x)) });
      const setY = (id: string, p: BlockPos, y: number) => (updates[id] = { ...p, y: Math.round(Math.max(0, y)) });

      if (kind === "left") {
        const m = Math.min(...rects.map((r) => r.x));
        rects.forEach((r) => setX(r.id, r.p, m));
      } else if (kind === "right") {
        const m = Math.max(...rects.map((r) => r.x + r.w));
        rects.forEach((r) => setX(r.id, r.p, m - r.w));
      } else if (kind === "centerH") {
        const minX = Math.min(...rects.map((r) => r.x));
        const maxX = Math.max(...rects.map((r) => r.x + r.w));
        const cx = (minX + maxX) / 2;
        rects.forEach((r) => setX(r.id, r.p, cx - r.w / 2));
      } else if (kind === "top") {
        const m = Math.min(...rects.map((r) => r.y));
        rects.forEach((r) => setY(r.id, r.p, m));
      } else if (kind === "bottom") {
        const m = Math.max(...rects.map((r) => r.y + r.h));
        rects.forEach((r) => setY(r.id, r.p, m - r.h));
      } else if (kind === "middleV") {
        const minY = Math.min(...rects.map((r) => r.y));
        const maxY = Math.max(...rects.map((r) => r.y + r.h));
        const cy = (minY + maxY) / 2;
        rects.forEach((r) => setY(r.id, r.p, cy - r.h / 2));
      } else if (kind === "distV") {
        const sorted = [...rects].sort((a, b) => a.y - b.y);
        const top = sorted[0].y;
        const bottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h;
        const totalH = sorted.reduce((s, r) => s + r.h, 0);
        const gap = (bottom - top - totalH) / (sorted.length - 1);
        let y = top;
        sorted.forEach((r) => {
          setY(r.id, r.p, y);
          y += r.h + gap;
        });
      } else if (kind === "distH") {
        const sorted = [...rects].sort((a, b) => a.x - b.x);
        const left = sorted[0].x;
        const right = sorted[sorted.length - 1].x + sorted[sorted.length - 1].w;
        const totalW = sorted.reduce((s, r) => s + r.w, 0);
        const gap = (right - left - totalW) / (sorted.length - 1);
        let x = left;
        sorted.forEach((r) => {
          setX(r.id, r.p, x);
          x += r.w + gap;
        });
      }

      if (Object.keys(updates).length === 0) return;
      onChange({ ...data, layout: { ...layout, absolutePositions: { ...positions, ...updates } } });
    },
    [selectedIds, layout, defaultPositions, data, onChange, measureHeightPt]
  );

  return { alignSelected };
}
