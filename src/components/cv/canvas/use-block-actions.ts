"use client";

import { useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import type { CVData } from "@/types/cv";
import { defaultLayout, removeCustomSection, getParentSectionId } from "@/lib/cv-layout";
import type { BlockPos } from "./snap";

const DUPLICABLE = /^(skill|experience|project|education)_(\d+)$/;

const SECTION_KEYS = {
  skill: "skills",
  experience: "experiences",
  project: "projects",
  education: "education",
} as const;

interface UseBlockActionsArgs {
  data: CVData;
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData) => void;
}

/** Actions sur les blocs partagées entre le menu contextuel et le clavier :
 *  hauteur auto, position par défaut, duplication, masquage de section. */
export function useBlockActions({ data, defaultPositions, onChange }: UseBlockActionsArgs) {
  const layout = useMemo(() => data.layout ?? defaultLayout(), [data.layout]);
  const saved = useMemo(() => layout.absolutePositions ?? {}, [layout.absolutePositions]);

  const updatePositions = useCallback(
    (updates: Record<string, BlockPos | undefined>) => {
      const next = { ...saved };
      for (const [id, pos] of Object.entries(updates)) {
        if (pos) next[id] = pos;
        else delete next[id];
      }
      onChange({ ...data, layout: { ...layout, absolutePositions: next } });
    },
    [data, layout, saved, onChange]
  );

  /** Supprime la hauteur explicite → le contenu reprend sa hauteur naturelle. */
  const autoHeight = useCallback(
    (ids: string[]) => {
      const updates: Record<string, BlockPos> = {};
      for (const id of ids) {
        const pos = saved[id];
        if (pos?.h) updates[id] = { ...pos, h: undefined };
      }
      if (Object.keys(updates).length) updatePositions(updates);
    },
    [saved, updatePositions]
  );

  /** Remet les blocs à leur position calculée par défaut. */
  const resetPosition = useCallback(
    (ids: string[]) => {
      const updates: Record<string, BlockPos> = {};
      for (const id of ids) {
        if (defaultPositions[id]) updates[id] = defaultPositions[id];
      }
      if (Object.keys(updates).length) updatePositions(updates);
    },
    [defaultPositions, updatePositions]
  );

  const canDuplicate = useCallback((blockId: string) => DUPLICABLE.test(blockId), []);

  /** Duplique l'élément de données (expérience, projet, compétence, formation). */
  const duplicateItem = useCallback(
    (blockId: string) => {
      const m = blockId.match(DUPLICABLE);
      if (!m) return;
      const key = SECTION_KEYS[m[1] as keyof typeof SECTION_KEYS];
      const idx = parseInt(m[2]);
      const list = data[key] as { id?: string }[];
      const item = list[idx];
      if (!item) return;
      const copy = { ...item, id: uuidv4() };
      onChange({ ...data, [key]: [...list.slice(0, idx + 1), copy, ...list.slice(idx + 1)] });
    },
    [data, onChange]
  );

  /** Masque la section parente d'un bloc (suppression définitive si custom). */
  const hideSectionOf = useCallback(
    (blockId: string) => {
      const sectionId = getParentSectionId(blockId);
      if (sectionId.startsWith("custom_")) {
        onChange(removeCustomSection(data, sectionId));
        return;
      }
      const pages = layout.pages.map((p) => ({
        main: p.main.filter((s) => s !== sectionId),
        sidebar: p.sidebar.filter((s) => s !== sectionId),
      }));
      onChange({ ...data, layout: { ...layout, pages } });
    },
    [data, layout, onChange]
  );

  return { autoHeight, resetPosition, canDuplicate, duplicateItem, hideSectionOf };
}
