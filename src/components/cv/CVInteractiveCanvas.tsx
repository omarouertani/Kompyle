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
  dedupePages,
  hasDuplicateSections,
} from "@/lib/cv-layout";
import { cn } from "@/lib/utils";
import { Maximize2, MoveUpRight, MoveRight, Copy, EyeOff, RotateCcw, SquarePlus } from "lucide-react";
import { CVPageScaleWrapper, PT_TO_PX, A4_WIDTH_PX, ptsToPx, SELECTION_COLOR } from "./cv-canvas-primitives";
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

  // Résout un drop drag-and-drop inter-pages (assigné plus bas, une fois
  // moveSectionToPage défini ; mis à jour à chaque rendu via la ref).
  const resolveDropRef = useRef<((blockId: string, clientX: number, clientY: number, screenDx: number, screenDy: number) => boolean) | null>(null);

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
  } = useCanvasInteractions({ data, defaultPositions, onChange, resolveDropRef });

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

  // Auto-réparation : un layout corrompu (section référencée 2× après un
  // déplacement) provoque des clés dupliquées et des blocs empilés. On dé-duplique.
  useEffect(() => {
    if (hasDuplicateSections(layout.pages)) {
      onChange({ ...data, layout: { ...layout, pages: dedupePages(layout.pages) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

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

      // Ctrl/Cmd + D → duplique le 1er élément duplicable sélectionné
      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        const duplicable = selectedIds.find(canDuplicate);
        if (duplicable) {
          e.preventDefault();
          duplicateItem(duplicable);
        }
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
  }, [selectedIds, layout, data, defaultPositions, onChange, hideSectionOf, clearSelection, canDuplicate, duplicateItem]);

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

  /** Réorganisation automatique : empile chaque colonne en mesurant la hauteur
   *  RÉELLE rendue de chaque bloc, en respectant la limite A4 — un bloc qui
   *  dépasserait le bas de page bascule sur la page suivante (créée au besoin).
   *  Garantit : pas de chevauchement, rien sous la ligne limite, PDF complet. */
  const realign = useCallback(() => {
    const isCh = template === "chaima";
    const sidebarW = layout.sidebarWidth ?? (isCh ? 175 : 165);
    const dpages = dedupePages(layout.pages);

    const positions: Record<string, BlockPos> = {};
    const blockPages: Record<string, number> = {};
    // Le header garde ses positions par défaut (nom / rôle / photo…)
    const defs = getDefaultPositions(template, data);
    for (const id of ["photo", "name", "role", "techLine"]) {
      if (defs[id]) positions[id] = defs[id];
    }

    // Mesure la hauteur rendue (px non scalés → pt) à la largeur cible.
    const measure = (id: string, w: number): number => {
      const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
      if (!el) return 22;
      const prev = el.style.width;
      el.style.width = `${w * PT_TO_PX}px`;
      const h = el.offsetHeight / PT_TO_PX; // lecture = reflow forcé
      el.style.width = prev;
      return Math.max(12, h);
    };

    const SECTION_GAP = 12;   // entre deux sections
    const TITLE_GAP = 4;      // après un titre de section
    const ITEM_GAP = 7;       // entre deux éléments d'une section
    const PAGE_BOTTOM = 812;  // A4 = 842pt, marge basse de 30pt
    const topYOf = (pi: number) => (pi === 0 ? (isCh ? 100 : 95) : 30);

    let pagesNeeded = dpages.length;

    /** Écoule une colonne sur les pages : sections dans l'ordre des pages, blocs
     *  empilés ; au-delà de la limite A4 → page suivante (jamais avant sa page
     *  d'origine). Un titre n'est jamais orphelin en bas de page. */
    const flow = (col: "sidebar" | "main", x: number, w: number) => {
      const entries: { sid: string; home: number }[] = [];
      dpages.forEach((p, pi) => p[col].forEach((sid) => entries.push({ sid, home: pi })));

      let pi = 0;
      let y = topYOf(0);
      const nextPage = () => {
        pi++;
        y = topYOf(pi);
        pagesNeeded = Math.max(pagesNeeded, pi + 1);
      };

      for (const { sid, home } of entries) {
        const ids = getSectionBlockIds(sid, data);
        if (ids.length === 0) continue;
        // Une section ne remonte jamais avant la page où elle est rangée
        if (pi < home) {
          pi = home;
          y = topYOf(pi);
          pagesNeeded = Math.max(pagesNeeded, pi + 1);
        } else if (y > topYOf(pi)) {
          y += SECTION_GAP;
        }

        const heights = ids.map((bid) => measure(bid, w));
        ids.forEach((bid, idx) => {
          const h = heights[idx];
          // Le titre (idx 0) doit tenir avec au moins le début du 1er item
          const needed = idx === 0 ? h + TITLE_GAP + Math.min(heights[1] ?? 0, 36) : h;
          if (y + needed > PAGE_BOTTOM && y > topYOf(pi)) nextPage();
          positions[bid] = { x, y, w };
          if (pi !== home) blockPages[bid] = pi;
          y += h + (idx === 0 ? TITLE_GAP : ITEM_GAP);
        });
      }
    };

    const sideX = isCh ? 12 : 24;
    const sideW = isCh ? sidebarW - 24 : sidebarW;
    const mainX = isCh ? sidebarW + 20 : sidebarW + 30;
    const mainW = isCh ? 595 - sidebarW - 35 : 595 - sidebarW - 54;
    flow("sidebar", sideX, sideW);
    flow("main", mainX, mainW);

    const nextPages = [...dpages];
    while (nextPages.length < pagesNeeded) nextPages.push(emptyLayoutPage());

    onChange({
      ...data,
      layout: { ...layout, pages: nextPages, absolutePositions: positions, blockPages, useAbsolutePositioning: true },
    });
  }, [data, layout, template, onChange]);

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
      // réinitialise uniquement les blocs de la section déplacée.
      const recomputed = getDefaultPositions(template, nextData);
      const moved = getSectionBlockIds(sectionId, nextData);
      const nextPositions = { ...(layout.absolutePositions ?? {}) };
      // La section entière suit la page → on efface les surcharges par bloc.
      const nextBlockPages = { ...(layout.blockPages ?? {}) };
      for (const bId of moved) {
        if (recomputed[bId]) nextPositions[bId] = recomputed[bId];
        delete nextBlockPages[bId];
      }

      onChange({
        ...nextData,
        layout: { ...nextData.layout!, absolutePositions: nextPositions, blockPages: nextBlockPages },
      });
      setActivePageIndex(targetPage);
    },
    [data, layout, template, onChange]
  );

  /** Page courante d'une section (pour masquer l'option "page actuelle"). */
  const pageOfSection = useCallback(
    (blockId: string): number => {
      const sectionId = getParentSectionId(blockId);
      return layout.pages.findIndex((p) => p.main.includes(sectionId) || p.sidebar.includes(sectionId));
    },
    [layout.pages]
  );

  /** Page d'origine "logique" d'un bloc : sa surcharge par bloc, sinon la page
   *  de sa section (header → page 0). */
  const homePageOf = useCallback(
    (id: string): number => {
      const ov = layout.blockPages?.[id];
      if (ov !== undefined && ov >= 0 && ov < layout.pages.length) return ov;
      const sp = pageOfSection(id);
      return sp === -1 ? 0 : sp;
    },
    [layout.blockPages, layout.pages.length, pageOfSection]
  );

  // Drag-and-drop inter-pages, à la Canva : seul(s) le(s) bloc(s) déplacé(s)
  // changent de page (pas toute la section). Chaque bloc atterrit là où était
  // son fantôme (position écran convertie en coordonnées pt de la page cible).
  const resolveDrop = useCallback(
    (blockId: string, clientX: number, clientY: number, screenDx: number, screenDy: number): boolean => {
      if (layout.pages.length < 2) return false;
      const pageEl = document
        .elementsFromPoint(clientX, clientY)
        .find((el) => el instanceof HTMLElement && el.dataset.pageIndex !== undefined) as HTMLElement | undefined;
      if (!pageEl) return false;
      const targetPage = Number(pageEl.dataset.pageIndex);
      if (targetPage === homePageOf(blockId)) return false; // drop sur sa propre page → commit normal

      const contentEl = pageEl.querySelector("[data-cv-page-content]") as HTMLElement | null;
      if (!contentEl) return false;
      const contentRect = contentEl.getBoundingClientRect();
      const scale = contentRect.width / A4_WIDTH_PX;
      if (!scale) return false;

      const group = selectedIds.includes(blockId) ? selectedIds : [blockId];
      const positions = { ...(layout.absolutePositions ?? defaultPositions) };
      const nextBlockPages = { ...(layout.blockPages ?? {}) };
      let changed = false;

      const HEADER = new Set(["photo", "name", "role", "techLine"]);
      for (const id of group) {
        if (HEADER.has(id)) continue; // le header reste sur la page 1
        const el = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
        if (!el) continue;
        const r = el.getBoundingClientRect();
        // Position écran finale du fantôme = position d'origine + déplacement
        const ptX = Math.max(0, Math.round((r.left + screenDx - contentRect.left) / scale / PT_TO_PX));
        const ptY = Math.max(0, Math.round((r.top + screenDy - contentRect.top) / scale / PT_TO_PX));
        const cur = positions[id] ?? defaultPositions[id] ?? { x: ptX, y: ptY, w: 150 };
        positions[id] = { ...cur, x: ptX, y: ptY };
        // Si le bloc retombe sur la page de sa section, on retire la surcharge.
        const sp = pageOfSection(id);
        if ((sp === -1 ? 0 : sp) === targetPage) delete nextBlockPages[id];
        else nextBlockPages[id] = targetPage;
        changed = true;
      }
      if (!changed) return false;

      onChange({ ...data, layout: { ...layout, absolutePositions: positions, blockPages: nextBlockPages } });
      setActivePageIndex(targetPage);
      return true;
    },
    [data, layout, defaultPositions, selectedIds, onChange, homePageOf, pageOfSection]
  );

  useEffect(() => {
    resolveDropRef.current = resolveDrop;
  }, [resolveDrop]);

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
    // Déplacer la section vers une autre page
    if (isSectionBlock(menu.blockId) && layout.pages.length > 1) {
      const blockId = menu.blockId;
      const current = pageOfSection(blockId);
      layout.pages.forEach((_, pageIdx) => {
        if (pageIdx === current) return;
        items.push({
          label: `Déplacer vers la page ${pageIdx + 1}`,
          icon: MoveRight,
          onClick: () => moveSectionToPage(blockId, pageIdx),
        });
      });
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

  // Assemblage global : page d'accueil de chaque bloc (page de sa section ;
  // header → page 0), puis page effective = surcharge par bloc si présente.
  const renderPages = dedupePages(layout.pages);
  const blockHome = new Map<string, number>();
  for (const id of headerBlockIds) blockHome.set(id, 0);
  renderPages.forEach((pg, pi) => {
    for (const sid of [...pg.sidebar, ...pg.main]) {
      for (const bid of getSectionBlockIds(sid, data)) blockHome.set(bid, pi);
    }
  });
  const effectivePageOf = (id: string): number => {
    const ov = layout.blockPages?.[id];
    const home = blockHome.get(id) ?? 0;
    return ov !== undefined && ov >= 0 && ov < renderPages.length ? ov : home;
  };
  const blockIdsForPage = (pageIndex: number) =>
    [...blockHome.keys()].filter((id) => effectivePageOf(id) === pageIndex);

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
        {renderPages.map((page, pageIndex) => {
          const hasSidebar = page.sidebar.length > 0;
          const pageHeightPx = estimateAbsolutePageHeightPt(absolutePositions, data) * PT_TO_PX;
          const pageBlockIds = blockIdsForPage(pageIndex);

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
                    <div key={`sg-${i}`} className="absolute top-0 bottom-0 w-px z-40 pointer-events-none" style={{ left: ptsToPx(g.position), backgroundColor: SELECTION_COLOR }} />
                  ) : (
                    <div key={`sg-${i}`} className="absolute left-0 right-0 h-px z-40 pointer-events-none" style={{ top: ptsToPx(g.position), backgroundColor: SELECTION_COLOR }} />
                  )
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
        })}
      </div>

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
  );
}
