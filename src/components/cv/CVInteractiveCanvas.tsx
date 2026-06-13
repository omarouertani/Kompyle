"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { CVData, SectionId, CVLayout, CVTheme } from "@/types/cv";
import {
  defaultLayout,
  emptyLayoutPage,
  ALL_SECTION_IDS,
  getDefaultPositions,
  getDefaultPhotoPosition,
  getSectionBlockIds,
  getParentSectionId,
  addCustomSection,
  dedupePages,
  hasDuplicateSections,
  computePaginatedFlow,
  getColumnSections,
  getPageBlockIds,
  getSectionLabel,
  isModernTemplate,
} from "@/lib/cv-layout";
import { cn } from "@/lib/utils";
import { Maximize2, MoveUpRight, MoveRight, Copy, EyeOff, RotateCcw, SquarePlus, Lock, LockOpen } from "lucide-react";
import { CVPageScaleWrapper, PT_TO_PX, A4_WIDTH_PX, A4_HEIGHT_PX, ptsToPx, SELECTION_COLOR } from "./cv-canvas-primitives";
import { AbsoluteBlock } from "./canvas/AbsoluteBlock";
import { BlockContent, type BlockTheme } from "./canvas/BlockContent";
import { CanvasToolbar, ZOOM_MIN, ZOOM_MAX, type CanvasBackground } from "./canvas/CanvasToolbar";
import { FONT_FAMILIES } from "./canvas/ThemePanel";
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
  onOverflowChange?: (isOverflowing: boolean) => void;
}

/** Un bloc appartient-il à une section masquable (built-in ou custom) ? */
function isSectionBlock(blockId: string): boolean {
  const parent = getParentSectionId(blockId);
  return ALL_SECTION_IDS.includes(parent as SectionId) || parent.startsWith("custom_");
}

const HISTORY_LIMIT = 30;
/** Fenêtre de coalescence des snapshots d'historique (sliders, reflows). */
const HISTORY_COALESCE_MS = 400;

export default function CVInteractiveCanvas({ data, onChange: onChangeProp, template, onOverflowChange }: CVInteractiveCanvasProps) {
  const t = useTranslations("Canvas");
  // ── Undo / Redo ───────────────────────────────────────────────────────────
  // Pile de snapshots CVData poussée avant chaque mutation. Les mutations
  // rapprochées (<400 ms : drag de slider, auto-reflow consécutif à une
  // édition) sont coalescées en un seul pas d'annulation.
  const presentRef = useRef(data);
  useEffect(() => {
    presentRef.current = data;
  }, [data]);
  const undoStack = useRef<CVData[]>([]);
  const redoStack = useRef<CVData[]>([]);
  const lastPushTs = useRef(0);

  const onChange = useCallback(
    (next: CVData) => {
      const now = Date.now();
      if (now - lastPushTs.current > HISTORY_COALESCE_MS) {
        undoStack.current.push(presentRef.current);
        if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
        redoStack.current = [];
      }
      lastPushTs.current = now;
      onChangeProp(next);
    },
    [onChangeProp]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(presentRef.current);
    lastPushTs.current = 0; // la prochaine mutation repart sur un nouveau pas
    onChangeProp(prev);
  }, [onChangeProp]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(presentRef.current);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    lastPushTs.current = 0;
    onChangeProp(next);
  }, [onChangeProp]);

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
    lineHeight: theme.lineHeight ?? 1.2,
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
  const [canvasBg, setCanvasBg] = useState<CanvasBackground>("neutral");
  const [isExporting, setIsExporting] = useState(false);

  // Mesure la hauteur réelle d'un bloc rendu (offsetHeight est pré-scale).
  const measureHeightPt = useCallback((blockId: string): number | null => {
    const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
    return el ? el.offsetHeight / PT_TO_PX : null;
  }, []);

  // Auto-réparation : un layout corrompu (section référencée 2× après un
  // déplacement) provoque des clés dupliquées et des blocs empilés. On dé-duplique.
  useEffect(() => {
    if (hasDuplicateSections(layout.pages)) {
      onChange({ ...data, layout: { ...layout, pages: dedupePages(layout.pages) } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesKey]);

  // Construit un layout paginé : positions reflowées + blocs répartis sur
  // autant de pages que nécessaire (aucun bloc ne dépasse la hauteur A4).
  const buildPaginatedLayout = useCallback(
    (d: CVData, l: CVLayout, tpl: string): CVLayout | null => {
      const { positions, pageCount } = computePaginatedFlow(tpl, d, measureHeightPt);
      if (Object.keys(positions).length === 0) return null;
      const cols = getColumnSections(l);
      const pages = Array.from({ length: pageCount }, (_, p) => ({
        sidebar: cols.sidebar.filter((s) =>
          getSectionBlockIds(s, d).some((b) => (positions[b]?.page ?? 0) === p)
        ),
        main: cols.main.filter((s) =>
          getSectionBlockIds(s, d).some((b) => (positions[b]?.page ?? 0) === p)
        ),
      }));
      return { ...l, useAbsolutePositioning: true, autoPaginated: true, absolutePositions: positions, pages };
    },
    [measureHeightPt]
  );

  // Snapshots pour l'effet d'auto-reflow : on lit les dernières valeurs via des
  // refs au lieu de les mettre en dépendances — sinon l'effet se redéclenche à
  // CHAQUE render (data/layout changent d'identité), provoquant une boucle qui
  // fige l'app.
  const reflowRefs = useRef({ data, layout, template, onChange });
  reflowRefs.current = { data, layout, template, onChange };

  // Y a-t-il des positions sauvegardées ? (dépendance PRIMITIVE de l'effet)
  const hasSavedPositions = !!(layout.absolutePositions && Object.keys(layout.absolutePositions).length > 0);

  // DIAGNOSTIC : casse une éventuelle boucle de reflow et la signale.
  const reflowCount = useRef(0);

  // Auto-reflow mesuré : un CV SANS positions sauvegardées (nouveau, ou
  // fraîchement adapté/raffiné — l'API strippe alors absolutePositions) est
  // mis en page à partir des hauteurs RÉELLES des blocs, après chargement des
  // polices. Élimine les chevauchements dus aux estimations heuristiques quand
  // le contenu change de longueur. L'effet ne se déclenche QUE lorsque
  // `hasSavedPositions` passe à false → exécution unique, jamais en boucle.
  useEffect(() => {
    if (hasSavedPositions) { reflowCount.current = 0; return; }
    if (reflowCount.current > 10) { console.error("[Kompyle] REFLOW LOOP DETECTED — positions re-stripped after write"); return; }
    reflowCount.current++;

    let cancelled = false;
    const apply = () => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const { data: d, layout: l, template: tpl, onChange: oc } = reflowRefs.current;
        const nextLayout = buildPaginatedLayout(d, l, tpl);
        // Garde anti-boucle : ne jamais écrire un layout vide (sinon
        // hasSavedPositions resterait false et l'effet se relancerait).
        if (!nextLayout) return;
        oc({ ...d, layout: nextLayout });
      });
    };

    // Attendre les polices : leurs métriques changent la hauteur du texte.
    if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => { if (!cancelled) apply(); });
    } else {
      apply();
    }
    return () => { cancelled = true; };
  }, [hasSavedPositions, measureHeightPt, buildPaginatedLayout]);

  useEffect(() => {
    document.getElementById(`cv-page-${activePageIndex}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePageIndex]);

  // Ctrl/Cmd + molette → zoom
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Échelle finale (baseScale × zoom) rapportée par le wrapper — sert au
  // calcul du zoom « Ajuster à l'écran ».
  const finalScaleRef = useRef(1);
  const onScaleChange = useCallback(
    (s: number) => {
      finalScaleRef.current = s;
      handleScaleChange(s);
    },
    [handleScaleChange]
  );

  // Zoom « Ajuster » : la page remplit la largeur visible du canvas.
  const fitToScreen = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setZoom((currentZoom) => {
      const baseScale = currentZoom > 0 ? finalScaleRef.current / currentZoom : 1;
      if (!baseScale) return 1;
      const desired = (el.clientWidth - 48) / A4_WIDTH_PX;
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, desired / baseScale));
    });
  }, []);
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

  // Raccourcis clavier : Ctrl+Z/Y (undo/redo), Échap, Suppr (masquer),
  // flèches (déplacer la sélection)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditingText = target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      // Undo / Redo — actifs même sans sélection ; on laisse l'undo natif
      // dans les champs texte en cours d'édition.
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (isEditingText) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        if (isEditingText) return;
        e.preventDefault();
        redo();
        return;
      }

      if (selectedIds.length === 0) return;
      if (isEditingText) return;

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
      const positions: Record<string, BlockPos> = layout.absolutePositions ?? defaultPositions;
      const updates: Record<string, BlockPos> = {};
      for (const id of selectedIds) {
        const pos = positions[id];
        if (pos && !pos.locked) updates[id] = { ...pos, x: Math.max(0, pos.x + dx), y: Math.max(0, pos.y + dy) };
      }
      if (Object.keys(updates).length === 0) return;
      onChange({
        ...data,
        layout: { ...layout, absolutePositions: { ...positions, ...updates } },
      });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, layout, data, defaultPositions, onChange, hideSectionOf, clearSelection, canDuplicate, duplicateItem, undo, redo]);

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

  // « Tout réaligner » : reflow à partir des hauteurs RÉELLES mesurées dans le
  // DOM (et non des estimations), garantissant un empilement sans chevauchement.
  const realign = useCallback(() => {
    const nextLayout = buildPaginatedLayout(data, layout, template);
    if (!nextLayout) return;
    onChange({ ...data, layout: nextLayout });
  }, [data, layout, template, onChange, buildPaginatedLayout]);

  // Réalignement différé : attend que le DOM reflète le dernier onChange
  // (double rAF) avant de mesurer — utilisé après un changement de thème.
  const realignAfterRender = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const { data: d, layout: l, template: tpl, onChange: oc } = reflowRefs.current;
        const nextLayout = buildPaginatedLayout(d, l, tpl);
        if (nextLayout) oc({ ...d, layout: nextLayout });
      })
    );
  }, [buildPaginatedLayout]);

  /** Mise à jour du thème depuis la toolbar. `reflow` : les tailles/espacements
   *  ont changé → on réaligne les blocs sur leurs nouvelles hauteurs réelles. */
  const updateTheme = useCallback(
    (updates: Partial<CVTheme>, opts?: { reflow?: boolean }) => {
      const { data: d, layout: l, onChange: oc } = reflowRefs.current;
      if (Object.keys(updates).length > 0) {
        oc({ ...d, layout: { ...l, theme: { ...(l.theme ?? {}), ...updates } } });
      }
      if (opts?.reflow) realignAfterRender();
    },
    [realignAfterRender]
  );

  // ── Export PDF / PNG depuis la toolbar ────────────────────────────────────
  const exportFileBase = `CV_${data.personalInfo.name.replace(/\s+/g, "_") || "Kompyle"}`;

  const exportPng = useCallback(async () => {
    const pageEl = document.getElementById(`cv-page-${activePageIndex}`);
    if (!pageEl) return;
    setIsExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        backgroundColor: theme.pageBg || "#ffffff",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${exportFileBase}_page${activePageIndex + 1}.png`;
      a.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [activePageIndex, theme.pageBg, exportFileBase]);

  /** Verrouille / déverrouille un groupe de blocs (protège des drags accidentels). */
  const toggleLock = useCallback(
    (ids: string[]) => {
      const positions: Record<string, BlockPos> = layout.absolutePositions ?? defaultPositions;
      const anyUnlocked = ids.some((id) => !positions[id]?.locked);
      const updates: Record<string, BlockPos> = {};
      for (const id of ids) {
        const pos = positions[id] ?? defaultPositions[id];
        if (pos) updates[id] = { ...pos, locked: anyUnlocked };
      }
      if (Object.keys(updates).length === 0) return;
      onChange({
        ...data,
        layout: { ...layout, absolutePositions: { ...positions, ...updates } },
      });
    },
    [data, layout, defaultPositions, onChange]
  );

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
        // Si le bloc retombe sur la page de sa section (mode pages), la
        // surcharge devient inutile ; en mode autoPaginated, page fait foi.
        const sp = pageOfSection(id);
        const home = sp === -1 ? 0 : sp;
        const pageOverride = !layout.autoPaginated && home === targetPage ? undefined : targetPage;
        positions[id] = { ...cur, x: ptX, y: ptY, page: pageOverride };
        changed = true;
      }
      if (!changed) return false;

      onChange({ ...data, layout: { ...layout, absolutePositions: positions } });
      setActivePageIndex(targetPage);
      return true;
    },
    [data, layout, defaultPositions, selectedIds, onChange, homePageOf, pageOfSection]
  );

  useEffect(() => {
    resolveDropRef.current = resolveDrop;
  }, [resolveDrop]);

  const savedPositions = layout.absolutePositions ?? {};
  const absolutePositions: Record<string, BlockPos> = useMemo(
    () => ({ ...defaultPositions, ...savedPositions }),
    [defaultPositions, savedPositions]
  );

  // Bas de contenu RÉEL (mesuré) de la page la plus chargée. En mode paginé,
  // chaque page réinitialise `y` en haut → `pos.y + hauteur` est le bas dans la
  // page ; le max sur tous les blocs = la page la plus haute. Contrairement à
  // `estimateAbsolutePageHeightPt` (qui plancher à 842 + marge, donc toujours
  // « plein »), ceci détecte un VRAI débordement de la zone A4.
  const maxContentBottomPt = useMemo(() => {
    let worst = 0;
    for (const [id, pos] of Object.entries(absolutePositions)) {
      const h = measureHeightPt(id) ?? pos.h ?? 24;
      worst = Math.max(worst, pos.y + h);
    }
    return worst;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absolutePositions, data, measureHeightPt]);

  const isOverflowing = maxContentBottomPt * PT_TO_PX > A4_HEIGHT_PX;

  // Hauteur de page affichée : une A4 fixe en mode paginé (chaque page tient sur
  // une A4) ; sinon on laisse la page grandir pour montrer tout le contenu.
  const pageHeightPx = layout.autoPaginated
    ? A4_HEIGHT_PX
    : Math.max(A4_HEIGHT_PX, maxContentBottomPt * PT_TO_PX + 40);
  useEffect(() => {
    onOverflowChange?.(isOverflowing);
  }, [isOverflowing, onOverflowChange]);

  // Auto-pagination : dès que le contenu dépasse la hauteur d'une page A4,
  // on répartit les blocs sur une nouvelle page (mesure réelle). La garde
  // borne le nombre de tentatives — si un SEUL bloc dépasse la page (ex. une
  // expérience géante non sécable), on s'arrête au lieu de boucler.
  const paginateGuard = useRef(0);
  useEffect(() => {
    if (!isOverflowing) { paginateGuard.current = 0; return; }
    if (paginateGuard.current > 5) {
      console.warn("[Kompyle] Auto-pagination plafonnée — un bloc dépasse seul la page");
      return;
    }
    paginateGuard.current++;

    let cancelled = false;
    const run = () => requestAnimationFrame(() => {
      if (cancelled) return;
      const { data: d, layout: l, template: tpl, onChange: oc } = reflowRefs.current;
      const nextLayout = buildPaginatedLayout(d, l, tpl);
      if (nextLayout) oc({ ...d, layout: nextLayout });
    });

    if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => { if (!cancelled) run(); });
    } else {
      run();
    }
    return () => { cancelled = true; };
  }, [isOverflowing, buildPaginatedLayout]);

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
        { label: t("menu_add_section"), icon: SquarePlus, onClick: () => onChange(addCustomSection(data)) },
        { label: t("menu_realign"), icon: RotateCcw, onClick: realign },
      ];
    }

    const items: ContextMenuItem[] = [];
    if (targets.some((id) => savedPositions[id]?.h)) {
      items.push({ label: t("menu_auto_height"), icon: Maximize2, onClick: () => autoHeight(targets) });
    }
    items.push({ label: t("menu_default_position"), icon: MoveUpRight, onClick: () => resetPosition(targets) });
    {
      const allLocked = targets.every((id) => ((savedPositions[id] ?? defaultPositions[id]) as BlockPos | undefined)?.locked);
      items.push({
        label: allLocked ? t("menu_unlock") : t("menu_lock"),
        icon: allLocked ? LockOpen : Lock,
        onClick: () => toggleLock(targets),
      });
    }
    if (canDuplicate(menu.blockId)) {
      const blockId = menu.blockId;
      items.push({ label: t("menu_duplicate"), icon: Copy, onClick: () => duplicateItem(blockId) });
    }
    // Déplacer la section vers une autre page
    if (isSectionBlock(menu.blockId) && layout.pages.length > 1) {
      const blockId = menu.blockId;
      const current = pageOfSection(blockId);
      layout.pages.forEach((_, pageIdx) => {
        if (pageIdx === current) return;
        items.push({
          label: t("menu_move_to_page", { page: pageIdx + 1 }),
          icon: MoveRight,
          onClick: () => moveSectionToPage(blockId, pageIdx),
        });
      });
    }
    if (isSectionBlock(menu.blockId)) {
      const blockId = menu.blockId;
      const isCustom = getParentSectionId(blockId).startsWith("custom_");
      items.push({
        label: isCustom ? t("menu_delete_section") : t("menu_hide_section"),
        icon: EyeOff,
        danger: true,
        separator: true,
        onClick: () => {
          hideSectionOf(blockId);
          clearSelection();
        },
      });
    }
    items.push({ label: t("menu_realign"), icon: RotateCcw, separator: true, onClick: realign });
    return items;
  };

  /** Nom lisible d'un bloc (label affiché au survol). */
  const blockLabel = (id: string): string => {
    const HEADER_LABELS: Record<string, string> = {
      photo: t("block_photo"),
      name: t("block_name"),
      role: t("block_role"),
      techLine: t("block_techline"),
    };
    if (HEADER_LABELS[id]) return HEADER_LABELS[id];
    return getSectionLabel(getParentSectionId(id), data);
  };

  const renderBlock = (id: string) => {
    const pos = resolvePos(id);
    // Resize diagonal : le texte du bloc suit l'échelle sauvegardée
    const fs = pos.fontScale ?? 1;
    const themeForBlock: BlockTheme =
      fs === 1
        ? blockTheme
        : {
            ...blockTheme,
            baseFontSize: blockTheme.baseFontSize * fs,
            headingFontSize: blockTheme.headingFontSize * fs,
          };
    return (
      <AbsoluteBlock
        key={id}
        id={id}
        pos={pos}
        isSelected={selectedIds.includes(id)}
        isInteracting={isDragging || isResizing}
        label={blockLabel(id)}
        onDragStart={startDrag}
        onResizeStart={startResize}
        onResetHeight={(blockId) => autoHeight([blockId])}
        onContextMenu={openBlockMenu}
      >
        <BlockContent blockId={id} data={data} theme={themeForBlock} onChange={onChange} />
      </AbsoluteBlock>
    );
  };

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
      className="relative flex-1 flex flex-col bg-muted/40 rounded-xl border border-border/40 select-none overflow-hidden w-full"
      onMouseDown={handleBackgroundMouseDown}
    >
      <CanvasToolbar
        pageCount={layout.pages.length}
        activePageIndex={activePageIndex}
        zoom={zoom}
        theme={theme}
        canvasBg={canvasBg}
        isExporting={isExporting}
        onThemeChange={updateTheme}
        onSelectPage={setActivePageIndex}
        onAddPage={addPage}
        onRemovePage={removePage}
        onZoomChange={setZoom}
        onZoomFit={fitToScreen}
        onRealign={realign}
        onCanvasBgChange={setCanvasBg}
        onExportPng={exportPng}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-4 flex flex-col gap-6 min-h-0 w-full scrollbar-thin"
        style={
          canvasBg === "dots"
            ? { backgroundImage: "radial-gradient(circle, rgba(99,102,241,0.22) 1px, transparent 1px)", backgroundSize: "18px 18px" }
            : canvasBg === "grid"
              ? { backgroundImage: "linear-gradient(rgba(99,102,241,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.10) 1px, transparent 1px)", backgroundSize: "24px 24px" }
              : undefined
        }
        onContextMenu={openCanvasMenu}
      >
        {layout.pages.map((page, pageIndex) => {
          const { sidebar: sidebarBlocks, main: mainBlocks } = getPageBlockIds(layout, data, pageIndex);
          const hasSidebar = sidebarBlocks.length > 0;
          const pageBlockIds = [
            ...(pageIndex === 0 ? headerBlockIds : []),
            ...sidebarBlocks,
            ...mainBlocks,
          ];

          return (
            <CVPageScaleWrapper
              key={pageIndex}
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
      {/* eslint-disable-next-line react-hooks/refs -- les piles d'historique ne sont lues que dans les onClick, pas au rendu */}
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />}
    </div>
  );
}
