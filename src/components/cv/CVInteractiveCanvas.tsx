"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CVData } from "@/types/cv";
import {
  defaultLayout,
  getDefaultPositions,
  getDefaultPhotoPosition,
  getParentSectionId,
  dedupePages,
  hasDuplicateSections,
  getSectionLabel,
  isModernTemplate,
} from "@/lib/cv-layout";
import { Lock } from "lucide-react";
import { stripHtml } from "@/utils/strip-html";
import { SELECTION_COLOR } from "./cv-canvas-primitives";
import { type BlockTheme } from "./canvas/BlockContent";
import { CanvasToolbar, type CanvasBackground } from "./canvas/CanvasToolbar";
import { CanvasFormatProvider } from "./canvas/use-canvas-format";
import { FONT_FAMILIES } from "./canvas/ThemePanel";
import { ContextMenu } from "./canvas/ContextMenu";
import { MultiSelectToolbar } from "./canvas/MultiSelectToolbar";
import { useCanvasInteractions, type GrabOffset, type DropMember } from "./canvas/use-canvas-interactions";
import { useBlockActions } from "./canvas/use-block-actions";
import { useSelectionFormat } from "./canvas/use-selection-format";
import { useMarquee } from "./canvas/use-marquee";
import type { BlockPos } from "./canvas/snap";
import { useUndoRedo } from "./canvas/use-undo-redo";
import { useCanvasZoom } from "./canvas/use-canvas-zoom";
import { useSpacePan } from "./canvas/use-space-pan";
import { usePageManagement } from "./canvas/use-page-management";
import { useGrouping } from "./canvas/use-grouping";
import { useAlignment } from "./canvas/use-alignment";
import { useCanvasPagination } from "./canvas/use-canvas-pagination";
import { usePageRouting } from "./canvas/use-page-routing";
import { useKeyboardShortcuts } from "./canvas/use-keyboard-shortcuts";
import { useContextMenu } from "./canvas/use-context-menu";
import { getHeaderBlockIds } from "./canvas/block-helpers";
import { CanvasPage } from "./canvas/CanvasPage";
import { CanvasBlock } from "./canvas/CanvasBlock";

interface CVInteractiveCanvasProps {
  data: CVData;
  onChange: (newData: CVData) => void;
  template: string;
  originalData?: CVData | null;
  onOverflowChange?: (isOverflowing: boolean) => void;
}

export default function CVInteractiveCanvas({ data, onChange: onChangeProp, template, onOverflowChange }: CVInteractiveCanvasProps) {
  const t = useTranslations("Canvas");

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const { onChange, undo, redo } = useUndoRedo(data, onChangeProp);

  // ── Layout & thème dérivés ──────────────────────────────────────────────────
  const layout = data.layout ?? defaultLayout();
  const theme = layout.theme ?? {};
  const isChaima = isModernTemplate(template);

  const primaryColor = theme.primaryColor || (isChaima ? "#fbbf24" : "#1a1a1a");
  const textColor = theme.textColor || "#27272a";
  const sidebarBg = theme.sidebarBg || (isChaima ? "#f4f4f5" : "transparent");
  const sidebarWidth = layout.sidebarWidth ?? (isChaima ? 175 : 165);
  const photoSize = getDefaultPhotoPosition(template, sidebarWidth).w;
  const pageBg = theme.pageBg || "#ffffff";
  const fontStack = FONT_FAMILIES[theme.fontFamily ?? "sans"].stack;

  const blockTheme: BlockTheme = {
    isChaima,
    primaryColor,
    baseFontSize: theme.fontSize ?? (isChaima ? 9.5 : 10),
    headingFontSize: theme.headingSize ?? 12,
    lineHeight: theme.lineHeight ?? 1.15,
    photoSize,
    skillMode: theme.skillMode,
  };

  const pagesKey = useMemo(
    () => layout.pages.map((p) => `${p.main.join(",")}|${p.sidebar.join(",")}`).join("||"),
    [layout.pages]
  );

  // Structural key: only recalculate positions when the NUMBER of items changes
  // (not on every text edit). Text edits change data identity but don't affect
  // block positions — only adding/removing experiences/skills/etc. does.
  const structuralKey = useMemo(
    () =>
      `${data.experiences?.length ?? 0}_${data.projects?.length ?? 0}_${data.skills?.length ?? 0}_${data.education?.length ?? 0}_${data.spokenLanguages?.length ?? 0}_${data.customSections?.length ?? 0}_${data.personalInfo?.photo ? 1 : 0}_${data.personalInfo?.portfolio ? 1 : 0}_${data.personalInfo?.birthDate ? 1 : 0}_${data.personalInfo?.certifications?.length ?? 0}_${data.personalInfo?.interests?.length ?? 0}`,
    [data.experiences?.length, data.projects?.length, data.skills?.length, data.education?.length, data.spokenLanguages?.length, data.customSections?.length, data.personalInfo?.photo, data.personalInfo?.portfolio, data.personalInfo?.birthDate, data.personalInfo?.certifications?.length, data.personalInfo?.interests?.length]
  );

  const defaultPositions = useMemo(
    () => getDefaultPositions(template, data),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [template, structuralKey, layout.sidebarWidth, pagesKey]
  );

  // Résout un drop drag-and-drop inter-pages (assigné par usePageRouting via la
  // ref ; lu par useCanvasInteractions au mouseup).
  const resolveDropRef = useRef<((primaryId: string, clientX: number, clientY: number, grab: GrabOffset, members: DropMember[]) => boolean) | null>(null);

  // ── Interactions de base (sélection / drag / resize / lasso) ────────────────
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
  } = useCanvasInteractions({ data, template, defaultPositions, onChange, resolveDropRef });

  const { autoHeight, resetPosition, canDuplicate, duplicateItem, canDeleteBlock, deleteBlock, hideSectionOf } =
    useBlockActions({ data, defaultPositions, onChange });

  // Formatage au niveau bloc (sur la donnée, un seul onChange) : sélectionner un
  // bloc = styliser tout son texte. SET pour couleur/police, bascule pour gras…
  const { applyStyles, toggleCommand } = useSelectionFormat({ data, onChange });
  const canFormatSelection = selectedIds.some((id) => id !== "photo");
  // Pont vers les barres d'outils : foreColor = SET couleur ; le reste = bascule.
  const runBlockCommand = (command: string, value?: string) =>
    command === "foreColor"
      ? applyStyles(selectedIds, { color: value ?? "#000000" })
      : toggleCommand(selectedIds, command);

  const { marqueeRect, startMarquee } = useMarquee(setSelectedIds);

  // ── Refs des conteneurs ─────────────────────────────────────────────────────
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ── Zoom / Pan / Pages ──────────────────────────────────────────────────────
  const { zoom, setZoom, fitToScreen, onScaleChange } = useCanvasZoom({ scrollContainerRef, onScaleChange: handleScaleChange });
  const { activePageIndex, setActivePageIndex, addPage, removePage } = usePageManagement({ layout, data, onChange });
  const { spaceHeldRef, isSpaceHeld, isPanningActive, handlePanCapture } = useSpacePan({ scrollContainerRef });

  // Quadrillage affiché PAR DÉFAUT ; le bouton de la barre d'outils le retire
  // (cycle grid → neutral → dots → grid).
  const [canvasBg, setCanvasBg] = useState<CanvasBackground>("grid");

  // Auto-réparation : un layout corrompu (section référencée 2× après un
  // déplacement) provoque des clés dupliquées et des blocs empilés. On dé-duplique.
  useEffect(() => {
    if (hasDuplicateSections(layout.pages)) {
      onChange({ ...data, layout: { ...layout, pages: dedupePages(layout.pages) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  const savedPositions = useMemo(() => layout.absolutePositions ?? {}, [layout.absolutePositions]);
  const absolutePositions: Record<string, BlockPos> = useMemo(
    () => ({ ...defaultPositions, ...savedPositions }),
    [defaultPositions, savedPositions]
  );

  // ── Pagination / reflow / débordement / thème ───────────────────────────────
  const { measureHeightPt, realign, realignPreservingAfterRender, updateTheme, pageHeightPx } = useCanvasPagination({
    data,
    layout,
    template,
    onChange,
    onOverflowChange,
    absolutePositions,
  });

  // ── Groupement / alignement ─────────────────────────────────────────────────
  const { selectionHasGroup, groupSelected, ungroupSelected } = useGrouping({ selectedIds, layout, data, onChange, defaultPositions });
  const { alignSelected } = useAlignment({ selectedIds, layout, data, onChange, defaultPositions, measureHeightPt });

  // ── Routage inter-pages (déplacement de section, drop) ──────────────────────
  const { moveSectionToPage, pageOfSection, homePageOf } = usePageRouting({
    data,
    layout,
    template,
    defaultPositions,
    onChange,
    setActivePageIndex,
    resolveDropRef,
  });

  // ── Raccourcis clavier ──────────────────────────────────────────────────────
  useKeyboardShortcuts({
    selectedIds,
    layout,
    data,
    defaultPositions,
    onChange,
    hideSectionOf,
    clearSelection,
    canDuplicate,
    duplicateItem,
    undo,
    redo,
    fitToScreen,
    groupSelected,
    ungroupSelected,
  });

  // ── Menu contextuel ─────────────────────────────────────────────────────────
  const { menu, setMenu, openBlockMenu, openCanvasMenu, menuItems } = useContextMenu({
    data,
    layout,
    defaultPositions,
    selectedIds,
    setSelectedIds,
    clearSelection,
    onChange,
    realign,
    autoHeight,
    resetPosition,
    canDuplicate,
    duplicateItem,
    canDeleteBlock,
    deleteBlock,
    hideSectionOf,
    selectionHasGroup,
    groupSelected,
    ungroupSelected,
    pageOfSection,
    moveSectionToPage,
    addPage,
    removePage,
  });

  /** Résout la position d'un bloc : cas photo, position sauvegardée, ou
   *  placement d'un nouveau bloc sous ses voisins de section. */
  const resolvePos = (id: string): BlockPos => {
    // Photo : carrée (hauteur = largeur). La largeur vient de la position
    // sauvegardée → on peut l'AGRANDIR en tirant sur les coins de sélection.
    if (id === "photo") {
      const pos = absolutePositions[id] ?? { x: 50, y: 100, w: photoSize };
      return { ...pos, w: pos.w ?? photoSize, h: undefined };
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

  /** Nom lisible d'un bloc (label affiché au survol). */
  const blockLabel = (id: string): string => {
    const HEADER_LABELS: Record<string, string> = {
      photo: t("block_photo"),
      name: t("block_name"),
      role: t("block_role"),
      techLine: t("block_techline"),
      contactLine: t("block_contactline"),
    };
    if (HEADER_LABELS[id]) return HEADER_LABELS[id];
    // Le titre peut contenir du balisage de mise en forme (gras/couleur/…) —
    // on l'affiche en texte brut dans l'étiquette de survol / la barre d'info.
    return stripHtml(getSectionLabel(getParentSectionId(id), data));
  };

  const headerBlockIds = getHeaderBlockIds(data, template);

  const renderBlock = (id: string) => (
    <CanvasBlock
      key={id}
      id={id}
      pos={resolvePos(id)}
      isSelected={selectedIds.includes(id)}
      isInteracting={isDragging || isResizing}
      label={blockLabel(id)}
      blockTheme={blockTheme}
      data={data}
      onChange={onChange}
      onDragStart={startDrag}
      onResizeStart={startResize}
      autoHeight={autoHeight}
      onContextMenu={openBlockMenu}
    />
  );

  // Fond du canvas : clic gauche → lasso de sélection (clic simple = désélection)
  const handleBackgroundMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (spaceHeldRef.current) return; // pan en cours / armé → pas de lasso
    if (target.closest("[data-block-id]") || target.closest("[data-canvas-toolbar]")) return;
    clearSelection();
    const container = scrollContainerRef.current;
    if (container) startMarquee(e, container);
  };

  return (
    <CanvasFormatProvider>
    <div
      ref={canvasContainerRef}
      className="relative flex-1 flex flex-col bg-muted/40 rounded-xl border border-border/40 select-none overflow-hidden w-full"
      onMouseDown={handleBackgroundMouseDown}
    >
      <CanvasToolbar
        pageCount={layout.pages.length}
        activePageIndex={activePageIndex}
        zoom={zoom}
        theme={theme}
        canvasBg={canvasBg}
        onThemeChange={updateTheme}
        onSelectPage={setActivePageIndex}
        onAddPage={addPage}
        onZoomChange={setZoom}
        onZoomFit={fitToScreen}
        onRealign={realign}
        onCanvasBgChange={setCanvasBg}
        onReflow={realignPreservingAfterRender}
        selectedIds={selectedIds}
        onBlockCommand={(cmd, val) => runBlockCommand(cmd, val)}
        onBlockStyles={(styles) => applyStyles(selectedIds, styles)}
      />

      <MultiSelectToolbar
        count={isDragging || isResizing ? 0 : selectedIds.length}
        hasGroup={!!selectionHasGroup}
        onAlign={alignSelected}
        onGroup={groupSelected}
        onUngroup={ungroupSelected}
        canFormat={canFormatSelection}
        onApplyColor={(c) => { applyStyles(selectedIds, { color: c }); realignPreservingAfterRender(); }}
        onApplyFont={(stack) => { applyStyles(selectedIds, { "font-family": stack }); realignPreservingAfterRender(); }}
        onToggle={(cmd) => { toggleCommand(selectedIds, cmd); realignPreservingAfterRender(); }}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 flex flex-col gap-6 min-h-0 w-full scrollbar-thin"
        style={{
          ...(canvasBg === "dots"
            ? { backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.22) 1px, transparent 1px)", backgroundSize: "18px 18px" }
            : canvasBg === "grid"
              ? { backgroundImage: "linear-gradient(rgba(99,102,241,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.10) 1px, transparent 1px)", backgroundSize: "24px 24px" }
              : {}),
          cursor: isPanningActive ? "grabbing" : isSpaceHeld ? "grab" : undefined,
        }}
        onMouseDownCapture={handlePanCapture}
        onContextMenu={openCanvasMenu}
      >
        {layout.pages.map((page, pageIndex) => (
          <CanvasPage
            key={pageIndex}
            pageIndex={pageIndex}
            layout={layout}
            data={data}
            headerBlockIds={headerBlockIds}
            zoom={zoom}
            onScaleChange={onScaleChange}
            pageHeightPx={pageHeightPx}
            textColor={textColor}
            fontStack={fontStack}
            pageBg={pageBg}
            sidebarBg={sidebarBg}
            sidebarWidth={sidebarWidth}
            isChaima={isChaima}
            activePageIndex={activePageIndex}
            isDragging={isDragging}
            snapGuides={snapGuides}
            selectedIds={selectedIds}
            homePageOf={homePageOf}
            onSidebarResize={startSidebarResize}
            renderBlock={renderBlock}
          />
        ))}
      </div>

      {/* Info-bar de sélection : nom + X/Y/W/H du bloc sélectionné */}
      {selectedIds.length === 1 && !isDragging && !isResizing && (() => {
        const id = selectedIds[0];
        const pos = absolutePositions[id];
        if (!pos) return null;
        const h = pos.h ?? Math.round(measureHeightPt(id) ?? 0);
        const w = pos.w ?? 150;
        return (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-2.5 py-1 rounded-md bg-background/95 border border-border/80 shadow-md text-[10px] font-mono text-muted-foreground pointer-events-none">
            <span className="font-sans font-semibold text-foreground max-w-36 truncate">{blockLabel(id)}</span>
            {pos.locked && <Lock size={9} className="text-foreground" />}
            <span>X {Math.round(pos.x)}</span>
            <span>Y {Math.round(pos.y)}</span>
            <span>L {Math.round(w)}</span>
            <span>H {Math.round(h)}</span>
            <span className="text-border">pt</span>
          </div>
        );
      })()}

      {/* Lasso de sélection */}
      {marqueeRect && (
        <div
          className="fixed z-[90] pointer-events-none rounded-sm"
          style={{ ...marqueeRect, border: `1px solid ${SELECTION_COLOR}`, backgroundColor: `${SELECTION_COLOR}1a` }}
        />
      )}

      {/* Menu contextuel */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </div>
    </CanvasFormatProvider>
  );
}
