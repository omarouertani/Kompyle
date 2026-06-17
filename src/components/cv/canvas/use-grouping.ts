"use client";

import { useMemo, useCallback } from "react";
import type { CVData, CVLayout } from "@/types/cv";
import type { BlockPos } from "./snap";

interface UseGroupingArgs {
  selectedIds: string[];
  layout: CVLayout;
  data: CVData;
  onChange: (newData: CVData) => void;
  defaultPositions: Record<string, BlockPos>;
}

/** Groupement de blocs (Ctrl+G / Ctrl+Shift+G) : les blocs partageant un
 *  `groupId` se déplacent et se sélectionnent ensemble. */
export function useGrouping({ selectedIds, layout, data, onChange, defaultPositions }: UseGroupingArgs) {
  /** La sélection courante contient-elle au moins un bloc groupé ? */
  const selectionHasGroup = useMemo(
    () => selectedIds.some((id) => layout.absolutePositions?.[id]?.groupId),
    [selectedIds, layout.absolutePositions]
  );

  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const positions: Record<string, BlockPos> = { ...defaultPositions, ...(layout.absolutePositions ?? {}) };
    const gid = `g_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e4).toString(36)}`;
    const updates: Record<string, BlockPos> = {};
    for (const id of selectedIds) {
      const pos = positions[id] ?? defaultPositions[id];
      if (pos) updates[id] = { ...pos, groupId: gid };
    }
    if (Object.keys(updates).length === 0) return;
    onChange({ ...data, layout: { ...layout, absolutePositions: { ...positions, ...updates } } });
  }, [selectedIds, layout, defaultPositions, data, onChange]);

  const ungroupSelected = useCallback(() => {
    const positions: Record<string, BlockPos> = { ...defaultPositions, ...(layout.absolutePositions ?? {}) };
    const gids = new Set(selectedIds.map((id) => positions[id]?.groupId).filter(Boolean) as string[]);
    if (gids.size === 0) return;
    const updates: Record<string, BlockPos> = {};
    for (const [k, v] of Object.entries(positions)) {
      if (v.groupId && gids.has(v.groupId)) {
        const { groupId: _drop, ...rest } = v;
        void _drop;
        updates[k] = rest;
      }
    }
    if (Object.keys(updates).length === 0) return;
    onChange({ ...data, layout: { ...layout, absolutePositions: { ...positions, ...updates } } });
  }, [selectedIds, layout, defaultPositions, data, onChange]);

  return { selectionHasGroup, groupSelected, ungroupSelected };
}
