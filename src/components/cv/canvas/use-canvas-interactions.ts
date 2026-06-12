"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CVData } from "@/types/cv";
import { PT_TO_PX } from "../cv-canvas-primitives";
import { findSnapGuides, A4_WIDTH_PT, type BlockPos, type SnapGuide } from "./snap";

export type ResizeEdge = "e" | "w" | "n" | "s" | "ne" | "nw" | "se" | "sw";

interface UseCanvasInteractionsArgs {
  data: CVData;
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData) => void;
}

/** Sélection (simple ou multiple) + drag / resize / snap des blocs absolus.
 *  Pendant un geste, seules les propriétés CSS des blocs sont mises à jour
 *  (RAF) ; le state React n'est commité qu'au mouseup — d'où la fluidité. */
export function useCanvasInteractions({ data, defaultPositions, onChange }: UseCanvasInteractionsArgs) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // Snapshots pour les handlers d'événements (évite les closures périmées)
  const dataRef = useRef(data);
  const defaultPositionsRef = useRef(defaultPositions);
  const selectedIdsRef = useRef(selectedIds);
  const pageScaleRef = useRef(1);

  useEffect(() => {
    dataRef.current = data;
    defaultPositionsRef.current = defaultPositions;
    selectedIdsRef.current = selectedIds;
  }, [data, defaultPositions, selectedIds]);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const handleScaleChange = useCallback((scale: number) => {
    pageScaleRef.current = scale;
  }, []);

  const mouseDeltaToPts = useCallback((deltaPx: number) => {
    return deltaPx / PT_TO_PX / (pageScaleRef.current || 1);
  }, []);

  const resolveSavedPos = useCallback((id: string): BlockPos | undefined => {
    return dataRef.current.layout?.absolutePositions?.[id] ?? defaultPositionsRef.current[id];
  }, []);

  const commitPositions = useCallback(
    (updates: Record<string, BlockPos>) => {
      const current = dataRef.current;
      const layout = current.layout;
      if (!layout) return;
      const nextPositions = {
        ...(layout.absolutePositions ?? defaultPositionsRef.current),
        ...updates,
      };
      onChange({ ...current, layout: { ...layout, absolutePositions: nextPositions } });
    },
    [onChange]
  );

  const startDrag = useCallback(
    (e: React.MouseEvent, id: string, currentPos: BlockPos) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("span[contenteditable]") || target.closest("input")) return;
      e.preventDefault();

      // Ctrl/Cmd/Shift + clic : ajoute/retire de la sélection, sans drag
      if (e.ctrlKey || e.metaKey || e.shiftKey) {
        toggleSelect(id);
        return;
      }

      // Drag groupé si le bloc cliqué fait partie de la sélection courante
      const group = selectedIdsRef.current.includes(id) ? selectedIdsRef.current : [id];
      setSelectedIds(group);
      setIsDragging(true);

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      let rafId = 0;

      const blocks = group
        .map((blockId) => {
          const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
          const pos = blockId === id ? currentPos : resolveSavedPos(blockId);
          return el && pos ? { blockId, el, pos } : null;
        })
        .filter((b): b is { blockId: string; el: HTMLElement; pos: BlockPos } => b !== null);

      for (const b of blocks) {
        b.el.style.willChange = "left, top";
        b.el.style.zIndex = "50";
        b.el.style.opacity = "0.92";
      }

      // Candidats au snap : tous les blocs HORS sélection
      const groupSet = new Set(group);
      const snapCandidates: Record<string, BlockPos> = {};
      const allPositions = {
        ...defaultPositionsRef.current,
        ...(dataRef.current.layout?.absolutePositions ?? {}),
      };
      for (const [k, v] of Object.entries(allPositions)) {
        if (!groupSet.has(k)) snapCandidates[k] = v;
      }

      let pendingDx = 0;
      let pendingDy = 0;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const dx = mouseDeltaToPts(moveEvent.clientX - startMouseX);
          const dy = mouseDeltaToPts(moveEvent.clientY - startMouseY);

          // Le snap est calculé sur le bloc cliqué, puis appliqué au groupe
          const rawX = Math.round(currentPos.x + dx);
          const rawY = Math.round(currentPos.y + dy);
          const { guides, snappedX, snappedY } = findSnapGuides(id, rawX, rawY, currentPos.w ?? 150, snapCandidates);

          const clampedX = Math.max(0, Math.min(A4_WIDTH_PT - (currentPos.w ?? 50), snappedX));
          const clampedY = Math.max(0, snappedY);
          pendingDx = clampedX - currentPos.x;
          pendingDy = clampedY - currentPos.y;

          for (const b of blocks) {
            b.el.style.left = `${(b.pos.x + pendingDx) * PT_TO_PX}px`;
            b.el.style.top = `${Math.max(0, b.pos.y + pendingDy) * PT_TO_PX}px`;
          }
          setSnapGuides(guides);
        });
      };

      const handleMouseUp = () => {
        if (rafId) cancelAnimationFrame(rafId);
        for (const b of blocks) {
          b.el.style.willChange = "";
          b.el.style.zIndex = "";
          b.el.style.opacity = "";
        }
        setIsDragging(false);
        setSnapGuides([]);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        const updates: Record<string, BlockPos> = {};
        for (const b of blocks) {
          updates[b.blockId] = {
            ...b.pos,
            x: Math.max(0, Math.round(b.pos.x + pendingDx)),
            y: Math.max(0, Math.round(b.pos.y + pendingDy)),
          };
        }
        commitPositions(updates);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [commitPositions, mouseDeltaToPts, resolveSavedPos, toggleSelect]
  );

  const startResize = useCallback(
    (e: React.MouseEvent, id: string, currentPos: BlockPos, edge: ResizeEdge) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;

      const blockEl = document.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null;
      if (blockEl) blockEl.style.willChange = "left, top, width, height";

      const startW = currentPos.w ?? (blockEl ? blockEl.offsetWidth / PT_TO_PX : 150);
      // Hauteur de départ : explicite si définie, sinon mesurée sur le DOM
      const startH = currentPos.h ?? (blockEl ? blockEl.offsetHeight / PT_TO_PX : 40);

      let pendingX = currentPos.x;
      let pendingY = currentPos.y;
      let pendingW = startW;
      let pendingH = startH;
      let rafId = 0;

      const resizesW = edge.includes("e") || edge.includes("w");
      const resizesH = edge.includes("n") || edge.includes("s");
      const isLeft = edge.includes("w");
      const isTop = edge.includes("n");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const dx = mouseDeltaToPts(moveEvent.clientX - startMouseX);
          const dy = mouseDeltaToPts(moveEvent.clientY - startMouseY);

          if (resizesW) {
            if (isLeft) {
              pendingW = Math.max(40, startW - dx);
              pendingX = currentPos.x + (startW - pendingW);
            } else {
              pendingW = Math.max(40, startW + dx);
            }
          }
          if (resizesH) {
            if (isTop) {
              pendingH = Math.max(16, startH - dy);
              pendingY = currentPos.y + (startH - pendingH);
            } else {
              pendingH = Math.max(16, startH + dy);
            }
          }

          if (blockEl) {
            if (resizesW) {
              blockEl.style.width = `${pendingW * PT_TO_PX}px`;
              if (isLeft) blockEl.style.left = `${pendingX * PT_TO_PX}px`;
            }
            if (resizesH) {
              // minHeight : agrandir ajoute de l'espace, rétrécir ne coupe
              // jamais le contenu (le contenu définit le plancher)
              blockEl.style.minHeight = `${pendingH * PT_TO_PX}px`;
              if (isTop) blockEl.style.top = `${pendingY * PT_TO_PX}px`;
            }
          }
        });
      };

      const handleMouseUp = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (blockEl) blockEl.style.willChange = "";
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        commitPositions({
          [id]: {
            ...currentPos,
            x: Math.round(pendingX),
            y: Math.round(pendingY),
            w: Math.round(pendingW),
            ...(resizesH ? { h: Math.round(pendingH) } : {}),
          },
        });
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [commitPositions, mouseDeltaToPts]
  );

  const startSidebarResize = useCallback(
    (e: React.MouseEvent, startWidth: number) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      let rafId = 0;
      let lastWidth = startWidth;

      // RAF-throttlé : au plus un commit React par frame (un onChange par
      // événement mousemove re-rendait toute l'app et figeait la page).
      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const deltaPts = mouseDeltaToPts(moveEvent.clientX - startX);
          const nextWidth = Math.max(120, Math.min(300, Math.round(startWidth + deltaPts)));
          if (nextWidth === lastWidth) return;
          lastWidth = nextWidth;
          const current = dataRef.current;
          if (!current.layout) return;
          onChange({ ...current, layout: { ...current.layout, sidebarWidth: nextWidth } });
        });
      };

      const handleMouseUp = () => {
        if (rafId) cancelAnimationFrame(rafId);
        setIsResizing(false);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [mouseDeltaToPts, onChange]
  );

  return {
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
  };
}
