"use client";

import { useCallback } from "react";
import type { CVData, CVLayout, ElementPosition } from "@/types/cv";
import { getPageBlockIds } from "@/lib/cv-layout";
import { freeElementPos, freeElementsOnPage, isFreeElementId } from "@/lib/free-elements";
import { moveInStack, reorderStack, writeStackZ, type ZAction } from "@/lib/z-order";
import { pageStack } from "./CanvasPage";
import type { BlockPos } from "./snap";

interface UseLayersArgs {
  data: CVData;
  layout: CVLayout;
  headerBlockIds: string[];
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData) => void;
  /** Page où un bloc est affiché. */
  homePageOf: (id: string) => number;
}

/**
 * Ordre de superposition, masquage et verrou des blocs d'une page (menu
 * contextuel et panneau de calques). Toute écriture part de
 * `absolutePositions ?? defaultPositions`, comme les autres actions du canvas,
 * pour ne pas « perdre » les sections côté PDF.
 */
export function useLayers({ data, layout, headerBlockIds, defaultPositions, onChange, homePageOf }: UseLayersArgs) {
  /** Blocs d'une page, du fond vers l'avant (même ordre que le rendu). */
  const stackOf = useCallback(
    (pageIndex: number): string[] => {
      const { sidebar, main } = getPageBlockIds(layout, data, pageIndex);
      const free = freeElementsOnPage(layout, pageIndex).map(({ el }) => el.id);
      return pageStack(layout, pageIndex, headerBlockIds, [...sidebar, ...main], free);
    },
    [layout, data, headerBlockIds],
  );

  const resolve = useCallback(
    (id: string): ElementPosition | undefined => {
      if (isFreeElementId(id)) {
        const el = layout.freeElements?.find((f) => f.id === id);
        return el ? freeElementPos(el, layout.absolutePositions) : undefined;
      }
      return layout.absolutePositions?.[id] ?? defaultPositions[id];
    },
    [layout, defaultPositions],
  );

  const commit = useCallback(
    (positions: Record<string, ElementPosition>) =>
      onChange({ ...data, layout: { ...layout, absolutePositions: positions } }),
    [data, layout, onChange],
  );

  /** Écrit le nouvel ordre d'une ou plusieurs piles. */
  const writeStacks = useCallback(
    (stacks: string[][]) => {
      let positions: Record<string, ElementPosition> = { ...(layout.absolutePositions ?? defaultPositions) };
      for (const stack of stacks) positions = writeStackZ(positions, stack, resolve);
      commit(positions);
    },
    [layout.absolutePositions, defaultPositions, resolve, commit],
  );

  /** Premier plan / avancer / reculer / arrière-plan, page par page. */
  const reorder = useCallback(
    (ids: string[], action: ZAction) => {
      const pageOf = (id: string) => (isFreeElementId(id) ? (resolve(id)?.page ?? 0) : homePageOf(id));
      const pages = [...new Set(ids.map(pageOf))];
      writeStacks(pages.map((p) => reorderStack(stackOf(p), ids, action)));
    },
    [homePageOf, resolve, stackOf, writeStacks],
  );

  /** Glisser-déposer du panneau : `id` va à l'index `to` (du fond vers l'avant). */
  const moveTo = useCallback(
    (pageIndex: number, id: string, to: number) => writeStacks([moveInStack(stackOf(pageIndex), id, to)]),
    [stackOf, writeStacks],
  );

  /** Bascule un drapeau (`hidden` / `locked`) sur les ids : tous à vrai si un
   *  seul est faux, sinon tous à faux. */
  const toggleFlag = useCallback(
    (ids: string[], flag: "hidden" | "locked") => {
      const anyOff = ids.some((id) => !resolve(id)?.[flag]);
      const positions: Record<string, ElementPosition> = { ...(layout.absolutePositions ?? defaultPositions) };
      for (const id of ids) {
        const pos = resolve(id);
        if (pos) positions[id] = { ...pos, [flag]: anyOff };
      }
      commit(positions);
    },
    [layout.absolutePositions, defaultPositions, resolve, commit],
  );

  const isFlagged = useCallback((id: string, flag: "hidden" | "locked") => !!resolve(id)?.[flag], [resolve]);

  return { stackOf, reorder, moveTo, toggleFlag, isFlagged };
}
