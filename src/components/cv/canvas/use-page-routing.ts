"use client";

import { useEffect, useCallback } from "react";
import type { CVData, CVLayout } from "@/types/cv";
import {
  getDefaultPositions,
  getSectionBlockIds,
  getParentSectionId,
  dedupePages,
} from "@/lib/cv-layout";
import { PT_TO_PX, A4_WIDTH_PX } from "../cv-canvas-primitives";
import type { BlockPos } from "./snap";
import type { GrabOffset, DropMember } from "./use-canvas-interactions";

interface UsePageRoutingArgs {
  data: CVData;
  layout: CVLayout;
  template: string;
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData) => void;
  setActivePageIndex: (index: number) => void;
  resolveDropRef: React.MutableRefObject<
    ((primaryId: string, clientX: number, clientY: number, grab: GrabOffset, members: DropMember[]) => boolean) | null
  >;
}

/** Routage des blocs entre pages : page logique d'une section / d'un bloc,
 *  déplacement d'une section vers une autre page, et drop drag-and-drop
 *  inter-pages « à la Canva ». */
export function usePageRouting({
  data,
  layout,
  template,
  defaultPositions,
  onChange,
  setActivePageIndex,
  resolveDropRef,
}: UsePageRoutingArgs) {
  /** Déplace la section parente d'un bloc vers une autre page (même colonne) et
   *  recalcule les positions de ses blocs pour qu'ils se placent proprement sur
   *  la page cible (sinon ils restent à leurs anciennes coordonnées). */
  const moveSectionToPage = useCallback(
    (blockId: string, targetPage: number) => {
      const sectionId = getParentSectionId(blockId);
      // Colonne d'origine (pour replacer la section dans la même colonne)
      const fromSidebar = layout.pages.some((p) => p.sidebar.includes(sectionId));
      const col = fromSidebar ? "sidebar" : "main";

      const stripped = layout.pages.map((p) => ({
        main: p.main.filter((s) => s !== sectionId),
        sidebar: p.sidebar.filter((s) => s !== sectionId),
      }));
      if (!stripped[targetPage]) return;
      stripped[targetPage] = { ...stripped[targetPage], [col]: [...stripped[targetPage][col], sectionId] };
      const nextPages = dedupePages(stripped);

      const nextData: CVData = { ...data, layout: { ...layout, pages: nextPages } };
      // Recalcule les positions par défaut pour la nouvelle disposition, puis
      // réinitialise uniquement les blocs de la section déplacée (avec leur
      // nouvelle page — le routage par bloc lit position.page).
      const recomputed = getDefaultPositions(template, nextData);
      const moved = getSectionBlockIds(sectionId, nextData);
      const nextPositions = { ...(layout.absolutePositions ?? {}) };
      for (const bId of moved) {
        const base = recomputed[bId] ?? nextPositions[bId];
        if (base) nextPositions[bId] = { ...base, page: targetPage };
      }

      onChange({
        ...nextData,
        layout: { ...nextData.layout!, absolutePositions: nextPositions },
      });
      setActivePageIndex(targetPage);
    },
    [data, layout, template, onChange, setActivePageIndex]
  );

  /** Page courante d'une section (pour masquer l'option "page actuelle"). */
  const pageOfSection = useCallback(
    (blockId: string): number => {
      const sectionId = getParentSectionId(blockId);
      return layout.pages.findIndex((p) => p.main.includes(sectionId) || p.sidebar.includes(sectionId));
    },
    [layout.pages]
  );

  /** Page d'origine "logique" d'un bloc : sa surcharge position.page, sinon la
   *  page de sa section (header → page 0). */
  const homePageOf = useCallback(
    (id: string): number => {
      const ov = layout.absolutePositions?.[id]?.page;
      if (ov !== undefined && ov >= 0 && ov < layout.pages.length) return ov;
      const sp = pageOfSection(id);
      return sp === -1 ? 0 : sp;
    },
    [layout.absolutePositions, layout.pages.length, pageOfSection]
  );

  // Drag-and-drop inter-pages, à la Canva : seul(s) le(s) bloc(s) déplacé(s)
  // changent de page (pas toute la section). Chaque bloc atterrit là où était
  // son fantôme (position écran convertie en coordonnées pt de la page cible).
  const resolveDrop = useCallback(
    (primaryId: string, clientX: number, clientY: number, grab: GrabOffset, members: DropMember[]): boolean => {
      if (layout.pages.length < 2) return false;
      // La page cible est déterminée par la position EXACTE du curseur (pivot).
      const pageEl = document
        .elementsFromPoint(clientX, clientY)
        .find((el) => el instanceof HTMLElement && el.dataset.pageIndex !== undefined) as HTMLElement | undefined;
      if (!pageEl) return false;
      const targetPage = Number(pageEl.dataset.pageIndex);
      if (targetPage === homePageOf(primaryId)) return false; // drop sur sa propre page → commit normal

      const contentEl = pageEl.querySelector("[data-cv-page-content]") as HTMLElement | null;
      if (!contentEl) return false;
      const contentRect = contentEl.getBoundingClientRect();
      const scale = contentRect.width / A4_WIDTH_PX;
      if (!scale) return false;

      // Pivot curseur : coin supérieur gauche du bloc pivot reposé sous le
      // curseur (cursor − grab), puis chaque membre conserve son offset relatif.
      const primaryLeft = clientX - grab.dx;
      const primaryTop = clientY - grab.dy;

      const positions = { ...(layout.absolutePositions ?? defaultPositions) };
      let changed = false;

      const HEADER = new Set(["photo", "name", "role", "techLine"]);
      for (const m of members) {
        if (HEADER.has(m.id)) continue; // le header reste sur la page 1
        const screenLeft = primaryLeft + m.relLeft;
        const screenTop = primaryTop + m.relTop;
        const ptX = Math.max(0, Math.round((screenLeft - contentRect.left) / scale / PT_TO_PX));
        const ptY = Math.max(0, Math.round((screenTop - contentRect.top) / scale / PT_TO_PX));
        const cur = positions[m.id] ?? defaultPositions[m.id] ?? { x: ptX, y: ptY, w: 150 };
        // Si le bloc retombe sur la page de sa section (mode pages), la
        // surcharge devient inutile ; en mode autoPaginated, page fait foi.
        const sp = pageOfSection(m.id);
        const home = sp === -1 ? 0 : sp;
        const pageOverride = !layout.autoPaginated && home === targetPage ? undefined : targetPage;
        positions[m.id] = { ...cur, x: ptX, y: ptY, page: pageOverride };
        changed = true;
      }
      if (!changed) return false;

      onChange({ ...data, layout: { ...layout, absolutePositions: positions } });
      setActivePageIndex(targetPage);
      return true;
    },
    [data, layout, defaultPositions, onChange, homePageOf, pageOfSection, setActivePageIndex]
  );

  useEffect(() => {
    resolveDropRef.current = resolveDrop;
  }, [resolveDrop, resolveDropRef]);

  return { moveSectionToPage, pageOfSection, homePageOf };
}
