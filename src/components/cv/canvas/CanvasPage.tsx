"use client";

import React from "react";
import type { CVData, CVLayout } from "@/types/cv";
import { getPageBlockIds } from "@/lib/cv-layout";
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
  /** Rendu d'un bloc par son id (délégué à l'orchestrateur). */
  renderBlock: (id: string) => React.ReactNode;
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
}: CanvasPageProps) {
  const { sidebar: sidebarBlocks, main: mainBlocks } = getPageBlockIds(layout, data, pageIndex);
  const hasSidebar = sidebarBlocks.length > 0;
  const pageBlockIds = [
    ...(pageIndex === 0 ? headerBlockIds : []),
    ...sidebarBlocks,
    ...mainBlocks,
  ];

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
        style={{ color: textColor, fontFamily: fontStack, backgroundColor: pageBg, minHeight: `${pageHeightPx}px` }}
      >
        {hasSidebar && sidebarBg !== "transparent" && (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: ptsToPx(sidebarWidth),
              height: `${pageHeightPx}px`,
              backgroundColor: sidebarBg,
              borderRight: isChaima ? "1px solid #e4e4e7" : "none",
              zIndex: 1,
            }}
          />
        )}

        {hasSidebar && (
          <div
            className="absolute hover:bg-primary/40 hover:opacity-100 bg-transparent opacity-0 cursor-col-resize h-full transition-all duration-100 z-30"
            style={{ left: ptsToPx(sidebarWidth), width: "6px" }}
            title="Ajuster largeur sidebar"
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

        {pageBlockIds.map(renderBlock)}
      </div>
    </CVPageScaleWrapper>
  );
}
