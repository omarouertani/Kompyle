"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { CVData, SectionId } from "@/types/cv";
import {
  defaultLayout,
  emptyLayoutPage,
  ALL_SECTION_IDS,
  getDefaultPositions,
  getDefaultPhotoPosition,
  estimateAbsolutePageHeightPt,
  getSectionBlockIds,
  getParentSectionId,
  addCustomSection,
} from "@/lib/cv-layout";
import { cn } from "@/lib/utils";
import { Maximize2, MoveUpRight, Copy, EyeOff, RotateCcw, SquarePlus } from "lucide-react";
import { CVPageScaleWrapper, PT_TO_PX, ptsToPx } from "./cv-canvas-primitives";
import { AbsoluteBlock } from "./canvas/AbsoluteBlock";
import { BlockContent, type BlockTheme } from "./canvas/BlockContent";
import { CanvasToolbar, ZOOM_MIN, ZOOM_MAX } from "./canvas/CanvasToolbar";
import { ContextMenu, type ContextMenuItem } from "./canvas/ContextMenu";
import { useCanvasInteractions } from "./canvas/use-canvas-interactions";
import { useBlockActions } from "./canvas/use-block-actions";
import { useMarquee } from "./canvas/use-marquee";
import type { BlockPos } from "./canvas/snap";

interface CVInteractiveCanvasProps {
  data: CVData;
  onChange: (newData: CVData) => void;
  template: string;
  originalData?: CVData | null;
}

/** Un bloc appartient-il à une section masquable (built-in ou custom) ? */
function isSectionBlock(blockId: string): boolean {
  const parent = getParentSectionId(blockId);
  return ALL_SECTION_IDS.includes(parent as SectionId) || parent.startsWith("custom_");
}

export default function CVInteractiveCanvas({ data, onChange, template }: CVInteractiveCanvasProps) {
  const layout = data.layout ?? defaultLayout();
  const theme = layout.theme ?? {};
  const isChaima = template === "chaima";

  const primaryColor = theme.primaryColor || (isChaima ? "#fbbf24" : "#1a1a1a");
  const textColor = theme.textColor || "#27272a";
  const sidebarBg = theme.sidebarBg || (isChaima ? "#f4f4f5" : "transparent");
  const sidebarWidth = layout.sidebarWidth ?? (isChaima ? 175 : 165);
  const photoSize = getDefaultPhotoPosition(template, sidebarWidth).w;

  const blockTheme: BlockTheme = {
    isChaima,
    primaryColor,
    baseFontSize: theme.fontSize ?? (isChaima ? 9.5 : 10),
    headingFontSize: theme.headingSize ?? 12,
    lineHeight: theme.lineHeight ?? 1.2,
    photoSize,
  };

  const pagesKey = useMemo(
    () => layout.pages.map((p) => `${p.main.join(",")}|${p.sidebar.join(",")}`).join("||"),
    [layout.pages]
  );

  const defaultPositions = useMemo(
    () => getDefaultPositions(template, data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, data, layout.sidebarWidth, pagesKey]
  );

  const {
    selectedIds,
    setSelectedIds,
    clearSelection,
    snapGuides,
    isDragging,
    isResizing,
    handleScaleChange,
    startDrag,
    startResize,
    startSidebarResize,
  } = useCanvasInteractions({ data, defaultPositions, onChange });

  const { autoHeight, resetPosition, canDuplicate, duplicateItem, hideSectionOf } =
    useBlockActions({ data, defaultPositions, onChange });

  const { marqueeRect, startMarquee } = useMarquee(setSelectedIds);

  const [zoom, setZoom] = useState(1);
  const [rawPageIndex, setActivePageIndex] = useState(0);
  // Clampé au nombre de pages réel (évite un index orphelin après suppression)
  const activePageIndex = Math.min(rawPageIndex, layout.pages.length - 1);
  const [menu, setMenu] = useState<{ x: number; y: number; blockId: string | null } | null>(null);

  // Migration : les anciens CV (mode colonnes) basculent en positions absolues
  useEffect(() => {
    if (!layout.useAbsolutePositioning) {
      onChange({
        ...data,
        layout: {
          ...layout,
          useAbsolutePositioning: true,
          absolutePositions: layout.absolutePositions ?? defaultPositions,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.getElementById(`cv-page-${activePageIndex}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePageIndex]);

  // Ctrl/Cmd + molette → zoom
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // Raccourcis clavier : Échap, Suppr (masquer), flèches (déplacer la sélection)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        clearSelection();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const sectionBlocks = selectedIds.filter(isSectionBlock);
        // une seule section par appel (chaque appel commit un nouveau data)
        if (sectionBlocks.length > 0) hideSectionOf(sectionBlocks[0]);
        clearSelection();
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (dx === 0 && dy === 0) return;

      e.preventDefault();
      const positions = layout.absolutePositions ?? defaultPositions;
      const updates: Record<string, BlockPos> = {};
      for (const id of selectedIds) {
        const pos = positions[id];
        if (pos) updates[id] = { ...pos, x: Math.max(0, pos.x + dx), y: Math.max(0, pos.y + dy) };
      }
      onChange({
        ...data,
        layout: { ...layout, absolutePositions: { ...positions, ...updates } },
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, layout, data, defaultPositions, onChange, hideSectionOf, clearSelection]);

  const addPage = () => {
    const nextPages = [...layout.pages, emptyLayoutPage()];
    onChange({ ...data, layout: { ...layout, pages: nextPages } });
    setActivePageIndex(nextPages.length - 1);
  };

  const removePage = () => {
    if (layout.pages.length <= 1) return;
    const nextPages = layout.pages.filter((_, i) => i !== activePageIndex);
    onChange({ ...data, layout: { ...layout, pages: nextPages } });
    setActivePageIndex(Math.min(activePageIndex, nextPages.length - 1));
  };

  const realign = useCallback(() => {
    onChange({
      ...data,
      layout: { ...layout, absolutePositions: getDefaultPositions(template, data), useAbsolutePositioning: true },
    });
  }, [data, layout, template, onChange]);

  const savedPositions = layout.absolutePositions ?? {};
  const absolutePositions: Record<string, BlockPos> = {
    ...defaultPositions,
    ...savedPositions,
  };

  const resolvePos = (id: string): BlockPos => {
    // La photo garde sa taille de cercle, pas la largeur mesurée du conteneur
    if (id === "photo") {
      const pos = absolutePositions[id] ?? { x: 50, y: 100 };
      return { ...pos, w: photoSize, h: undefined };
    }
    if (savedPositions[id]) return savedPositions[id];

    // Nouveau bloc (ajout via sidebar) : si la section a déjà des blocs
    // positionnés à la main, le placer juste en dessous du plus bas.
    const def = defaultPositions[id] ?? { x: 50, y: 100, w: 200 };
    const parent = getParentSectionId(id);
    const siblings = Object.entries(savedPositions).filter(
      ([k]) => k !== id && getParentSectionId(k) === parent
    );
    if (siblings.length === 0) return def;

    const lowest = siblings.reduce((max, [, p]) => Math.max(max, p.y + (p.h ?? 40)), 0);
    const [, ref] = siblings[siblings.length - 1];
    return { x: ref.x, y: lowest + 8, w: ref.w ?? def.w };
  };

  // --- Menu contextuel ---
  const openBlockMenu = (e: React.MouseEvent, id: string) => {
    // clic droit dans un texte en édition → menu natif (coller, etc.)
    if ((e.target as HTMLElement).closest("[contenteditable]")) return;
    e.preventDefault();
    e.stopPropagation();
    if (!selectedIds.includes(id)) setSelectedIds([id]);
    setMenu({ x: e.clientX, y: e.clientY, blockId: id });
  };

  const openCanvasMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-block-id]")) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, blockId: null });
  };

  const menuItems = (): ContextMenuItem[] => {
    if (!menu) return [];
    const targets = menu.blockId
      ? selectedIds.includes(menu.blockId) ? selectedIds : [menu.blockId]
      : [];

    if (!menu.blockId) {
      return [
        { label: "Ajouter une section", icon: SquarePlus, onClick: () => onChange(addCustomSection(data)) },
        { label: "Tout réaligner", icon: RotateCcw, onClick: realign },
      ];
    }

    const items: ContextMenuItem[] = [];
    if (targets.some((id) => savedPositions[id]?.h)) {
      items.push({ label: "Hauteur auto", icon: Maximize2, onClick: () => autoHeight(targets) });
    }
    items.push({ label: "Position par défaut", icon: MoveUpRight, onClick: () => resetPosition(targets) });
    if (canDuplicate(menu.blockId)) {
      const blockId = menu.blockId;
      items.push({ label: "Dupliquer l'élément", icon: Copy, onClick: () => duplicateItem(blockId) });
    }
    if (isSectionBlock(menu.blockId)) {
      const blockId = menu.blockId;
      const isCustom = getParentSectionId(blockId).startsWith("custom_");
      items.push({
        label: isCustom ? "Supprimer la section" : "Masquer la section",
        icon: EyeOff,
        danger: true,
        separator: true,
        onClick: () => {
          hideSectionOf(blockId);
          clearSelection();
        },
      });
    }
    items.push({ label: "Tout réaligner", icon: RotateCcw, separator: true, onClick: realign });
    return items;
  };

  const renderBlock = (id: string) => (
    <AbsoluteBlock
      key={id}
      id={id}
      pos={resolvePos(id)}
      isSelected={selectedIds.includes(id)}
      isInteracting={isDragging || isResizing}
      onDragStart={startDrag}
      onResizeStart={startResize}
      onResetHeight={(blockId) => autoHeight([blockId])}
      onContextMenu={openBlockMenu}
    >
      <BlockContent blockId={id} data={data} theme={blockTheme} onChange={onChange} />
    </AbsoluteBlock>
  );

  const headerBlockIds = [
    ...(data.personalInfo.photo || isChaima ? ["photo"] : []),
    "name",
    "role",
    "techLine",
  ];

  // Fond du canvas : clic gauche → lasso de sélection (clic simple = désélection)
  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-block-id]") || target.closest("[data-canvas-toolbar]")) return;
    clearSelection();
    const container = scrollContainerRef.current;
    if (container) startMarquee(e, container);
  };

  return (
    <div
      ref={canvasContainerRef}
      className="flex-1 flex flex-col bg-muted/40 rounded-xl border border-border/40 select-none overflow-hidden w-full"
      onMouseDown={handleBackgroundMouseDown}
    >
      <CanvasToolbar
        pageCount={layout.pages.length}
        activePageIndex={activePageIndex}
        zoom={zoom}
        onSelectPage={setActivePageIndex}
        onAddPage={addPage}
        onRemovePage={removePage}
        onZoomChange={setZoom}
        onRealign={realign}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 flex flex-col gap-6 min-h-0 w-full scrollbar-thin"
        onContextMenu={openCanvasMenu}
      >
        {layout.pages.map((page, pageIndex) => {
          const hasSidebar = page.sidebar.length > 0;
          const pageHeightPx = estimateAbsolutePageHeightPt(absolutePositions, data) * PT_TO_PX;
          const pageBlockIds = [
            ...(pageIndex === 0 ? headerBlockIds : []),
            ...page.sidebar.flatMap((sectionId) => getSectionBlockIds(sectionId, data)),
            ...page.main.flatMap((sectionId) => getSectionBlockIds(sectionId, data)),
          ];

          return (
            <CVPageScaleWrapper
              key={pageIndex}
              zoom={zoom}
              pageIndex={pageIndex}
              onScaleChange={handleScaleChange}
              fitToContainer
              minContentHeightPx={pageHeightPx}
            >
              <div
                id={`cv-page-${pageIndex}`}
                className={cn(
                  "w-full text-zinc-800 text-left box-border relative",
                  activePageIndex === pageIndex && layout.pages.length > 1 && "ring-2 ring-primary/30 ring-offset-2 rounded-sm"
                )}
                style={{ color: textColor, fontFamily: "'Carlito', sans-serif", minHeight: `${pageHeightPx}px` }}
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
                      startSidebarResize(e, sidebarWidth);
                    }}
                  />
                )}

                {snapGuides.map((g, i) =>
                  g.orientation === "vertical" ? (
                    <div key={`sg-${i}`} className="absolute top-0 bottom-0 w-px bg-primary/50 z-40 pointer-events-none" style={{ left: ptsToPx(g.position) }} />
                  ) : (
                    <div key={`sg-${i}`} className="absolute left-0 right-0 h-px bg-primary/50 z-40 pointer-events-none" style={{ top: ptsToPx(g.position) }} />
                  )
                )}

                {pageBlockIds.map(renderBlock)}
              </div>
            </CVPageScaleWrapper>
          );
        })}
      </div>

      {/* Lasso de sélection */}
      {marqueeRect && (
        <div
          className="fixed border border-primary bg-primary/10 z-[90] pointer-events-none rounded-sm"
          style={marqueeRect}
        />
      )}

      {/* Menu contextuel */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </div>
  );
}
