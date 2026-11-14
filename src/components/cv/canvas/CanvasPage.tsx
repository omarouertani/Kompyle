"use client";

import { useTranslations } from "next-intl";
import React from "react";
import type { CVData, CVLayout } from "@/types/cv";
import { getPageBlockIds } from "@/lib/cv-layout";
import { freeElementsOnPage } from "@/lib/free-elements";
import { sortByZ } from "@/lib/z-order";
import { cn } from "@/lib/utils";
import { CVPageScaleWrapper, ptsToPx, SELECTION_COLOR } from "../cv-canvas-primitives";
import { SnapGuides } from "./SnapGuides";
import type { SnapGuide } from "./snap";

interface CanvasPageProps {
  pageIndex: number;
  layout: CVLayout;
  data: CVData;
  /** Ids des blocs d'en-tête (rendus uniquement sur la page 0). */
  headerBlockIds: string[];
  zoom: number;
  onScaleChange: (scale: number) => void;
  pageHeightPx: number;
  textColor: string;
  fontStack: string;
  pageBg: string;
  sidebarBg: string;
  sidebarWidth: number;
  isChaima: boolean;
  activePageIndex: number;
  isDragging: boolean;
  snapGuides: SnapGuide[];
  selectedIds: string[];
  /** Page logique d'un bloc (pour n'afficher les guides que sur la bonne page). */
  homePageOf: (id: string) => number;
  onSidebarResize: (e: React.MouseEvent, startWidth: number) => void;
  /** Rendu d'un bloc par son id et son rang de superposition (0 = au fond). */
  renderBlock: (id: string, rank: number) => React.ReactNode;
  /** Éléments libres de la page, rendus après (donc au-dessus) des sections. */
  freeElementIds?: string[];
}

/** Une page A4 du canvas : fond de sidebar, poignée de redimensionnement de
 *  sidebar, guides d'alignement, zone de dépôt inter-pages, et les blocs. */
export function CanvasPage({
  pageIndex,
  layout,
  data,
  headerBlockIds,
  zoom,
  onScaleChange,
  pageHeightPx,
  textColor,
  fontStack,
  pageBg,
  sidebarBg,
  sidebarWidth,
  isChaima,
  activePageIndex,
  isDragging,
  snapGuides,
  selectedIds,
  homePageOf,
  onSidebarResize,
  renderBlock,
  freeElementIds = [],
}: CanvasPageProps) {
  const tu = useTranslations("UI");
  const { sidebar: sidebarBlocks, main: mainBlocks } = getPageBlockIds(layout, data, pageIndex);
  const hasSidebar = sidebarBlocks.length > 0;
  const pageBlockIds = pageStack(layout, pageIndex, headerBlockIds, [...sidebarBlocks, ...mainBlocks], freeElementIds);

  return (
    <CVPageScaleWrapper
      zoom={zoom}
      pageIndex={pageIndex}
      onScaleChange={onScaleChange}
      fitToContainer
      minContentHeightPx={pageHeightPx}
    >
      <div
        id={`cv-page-${pageIndex}`}
        className={cn(
          "cv-page-shadow w-full text-zinc-800 text-left box-border relative rounded-[2px]",
          activePageIndex === pageIndex && layout.pages.length > 1 && "ring-2 ring-primary/30 ring-offset-2 rounded-sm"
        )}
        style={{
          color: textColor,
          fontFamily: fontStack,
          backgroundColor: pageBg,
          minHeight: `${pageHeightPx}px`,
          // Fond de sidebar peint dans la COUCHE BACKGROUND de la page (pas
          // un <div> positionné). Conséquence : la sidebar bg est toujours
          // derrière TOUT enfant positionné absolument — un bloc sélectionné
          // ne peut plus jamais « passer derrière » la sidebar (problème
          // observé même avec z-index 30 vs 1, à cause des contextes de
          // stacking imbriqués).
          ...(hasSidebar && sidebarBg !== "transparent"
            ? {
                backgroundImage: isChaima
                  ? `linear-gradient(to right, ${sidebarBg} calc(${ptsToPx(sidebarWidth)} - 1px), #e4e4e7 calc(${ptsToPx(sidebarWidth)} - 1px), #e4e4e7 ${ptsToPx(sidebarWidth)}, transparent ${ptsToPx(sidebarWidth)})`
                  : `linear-gradient(to right, ${sidebarBg} ${ptsToPx(sidebarWidth)}, transparent ${ptsToPx(sidebarWidth)})`,
              }
            : {}),
        }}
      >

        {hasSidebar && (
          <div
            className="absolute hover:bg-primary/40 hover:opacity-100 bg-transparent opacity-0 cursor-col-resize h-full transition-all duration-100 z-[500]"
            style={{ left: ptsToPx(sidebarWidth), width: "6px" }}
            title={tu("sidebar_resize")}
            onMouseDown={(e) => {
              e.stopPropagation();
              onSidebarResize(e, sidebarWidth);
            }}
          />
        )}

        {isDragging && snapGuides.length > 0 && selectedIds.length > 0 && homePageOf(selectedIds[0]) === pageIndex && (
          <SnapGuides guides={snapGuides} />
        )}

        {/* Indique les pages comme zones de dépôt pendant un drag */}
        {isDragging && layout.pages.length > 1 && (
          <div
            className="absolute inset-0 pointer-events-none rounded-sm z-[5]"
            style={{ outline: `2px dashed ${SELECTION_COLOR}55`, outlineOffset: 3 }}
          />
        )}

        {pageBlockIds.map((id, rank) => renderBlock(id, rank))}
      </div>
    </CVPageScaleWrapper>
  );
}

/** Blocs d'une page du fond vers l'avant (même ordre que le PDF). */
export function pageStack(
  layout: CVLayout,
  pageIndex: number,
  headerBlockIds: string[],
  sectionBlockIds: string[],
  freeElementIds: string[],
): string[] {
  const saved = layout.absolutePositions ?? {};
  const freePos = Object.fromEntries(freeElementsOnPage(layout, pageIndex).map(({ el, pos }) => [el.id, pos]));
  return sortByZ(
    [...(pageIndex === 0 ? headerBlockIds : []), ...sectionBlockIds, ...freeElementIds],
    (id) => freePos[id] ?? saved[id],
  );
}
