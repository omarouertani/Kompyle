"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CVData } from "@/types/cv";
import { PT_TO_PX, SELECTION_COLOR } from "../cv-canvas-primitives";
import { findSnapGuides, A4_WIDTH_PT, type BlockPos, type SnapGuide, type SnapRect } from "./snap";
import {
  getParentSectionId,
  isCanadianTemplate,
  isModernTemplate,
  ALL_SECTION_IDS,
  getDefaultPositions,
  getSectionBlockIds,
} from "@/lib/cv-layout";
import type { SectionId } from "@/types/cv";

export type ResizeEdge = "e" | "w" | "n" | "s" | "ne" | "nw" | "se" | "sw";

/** Géométrie écran d'un bloc du groupe déplacé, relative au bloc « pivot »
 *  (celui saisi par le curseur). Permet de reposer le groupe sous le curseur
 *  sur la page cible sans saut visuel. */
export interface DropMember {
  id: string;
  relLeft: number;
  relTop: number;
}

/** Décalage du curseur à l'intérieur du bloc pivot, au moment de la saisie. */
export interface GrabOffset {
  dx: number;
  dy: number;
}

interface UseCanvasInteractionsArgs {
  data: CVData;
  /** Template courant — sert à savoir si une sidebar existe (modern/classic) et
   *  à recalculer les positions lors d'un changement de colonne. */
  template: string;
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData) => void;
  /** Résout un drop inter-pages : renvoie true si le(s) bloc(s) ont changé de
   *  page (la position est alors gérée par l'appelant, pas par commitPositions).
   *  Le repositionnement utilise le CURSEUR comme pivot (grab + offsets relatifs)
   *  plutôt que le coin supérieur gauche du bloc → aucun saut de référentiel. */
  resolveDropRef?: {
    current: ((primaryId: string, clientX: number, clientY: number, grab: GrabOffset, members: DropMember[]) => boolean) | null;
  };
}

/** Étend un ensemble d'ids à tous les membres de leurs groupes respectifs. */
function expandGroups(ids: string[], positions: Record<string, BlockPos>): string[] {
  const result = new Set(ids);
  const groupIds = new Set<string>();
  for (const id of ids) {
    const g = positions[id]?.groupId;
    if (g) groupIds.add(g);
  }
  if (groupIds.size > 0) {
    for (const [k, v] of Object.entries(positions)) {
      if (v.groupId && groupIds.has(v.groupId)) result.add(k);
    }
  }
  return Array.from(result);
}

/** Sélection (simple ou multiple) + drag / resize / snap des blocs absolus.
 *  Pendant un geste, seules les propriétés CSS des blocs sont mises à jour
 *  (RAF) ; le state React n'est commité qu'au mouseup — d'où la fluidité. */
export function useCanvasInteractions({ data, template, defaultPositions, onChange, resolveDropRef }: UseCanvasInteractionsArgs) {
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
    (updates: Record<string, BlockPos>, primaryId?: string) => {
      const current = dataRef.current;
      const layout = current.layout;
      if (!layout) return;
      let pages = layout.pages;
      const nextPositions: Record<string, BlockPos> = {
        ...(layout.absolutePositions ?? defaultPositionsRef.current),
        ...updates,
      };

      // ── Sidebar = vraie zone : si on dépose un bloc de section dans la bande
      // sidebar (ou qu'on l'en sort), sa SECTION change de colonne (modern /
      // classic uniquement). Tout dans le même onChange → pas d'écrasement. ──
      const pos = primaryId ? updates[primaryId] : undefined;
      if (primaryId && pos && !isCanadianTemplate(template)) {
        const sectionId = getParentSectionId(primaryId);
        const isSection = ALL_SECTION_IDS.includes(sectionId as SectionId) || sectionId.startsWith("custom_");
        const curPageIdx = pages.findIndex((p) => p.main.includes(sectionId) || p.sidebar.includes(sectionId));
        if (isSection && curPageIdx >= 0) {
          const sidebarWidth = layout.sidebarWidth ?? (isModernTemplate(template) ? 175 : 165);
          const inSidebar = pages[curPageIdx].sidebar.includes(sectionId);
          // Hystérésis : on ne bascule que sur un franchissement net de la
          // frontière (évite les changements de colonne accidentels).
          let target = inSidebar;
          if (pos.x < sidebarWidth - 25) target = true;
          else if (pos.x > sidebarWidth + 10) target = false;

          if (target !== inSidebar) {
            pages = pages.map((p, i) =>
              i === curPageIdx
                ? {
                    main: target ? p.main.filter((s) => s !== sectionId) : [...p.main.filter((s) => s !== sectionId), sectionId],
                    sidebar: target ? [...p.sidebar.filter((s) => s !== sectionId), sectionId] : p.sidebar.filter((s) => s !== sectionId),
                  }
                : p
            );
            // Recale les blocs de la section déplacée dans leur NOUVELLE colonne
            // (sinon ils resteraient aux coordonnées de l'ancienne) → canvas == PDF.
            const nextData: CVData = { ...current, layout: { ...layout, pages } };
            const recomputed = getDefaultPositions(template, nextData);
            for (const bId of getSectionBlockIds(sectionId, nextData)) {
              if (recomputed[bId]) {
                nextPositions[bId] = curPageIdx > 0 ? { ...recomputed[bId], page: curPageIdx } : { ...recomputed[bId] };
              }
            }
          }
        }
      }

      onChange({ ...current, layout: { ...layout, pages, absolutePositions: nextPositions } });
    },
    [onChange, template]
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

      // Bloc verrouillé : sélectionnable (pour le déverrouiller) mais pas déplaçable
      if (currentPos.locked) {
        setSelectedIds([id]);
        return;
      }

      // Toutes les positions connues (défaut + sauvegardées) pour résoudre les
      // groupes et les candidats au snap.
      const allPositions: Record<string, BlockPos> = {
        ...defaultPositionsRef.current,
        ...(dataRef.current.layout?.absolutePositions ?? {}),
      };

      // Drag groupé : la sélection courante si le bloc cliqué en fait partie,
      // sinon le bloc seul — puis on étend aux membres de groupe (Ctrl+G).
      const base = selectedIdsRef.current.includes(id) ? selectedIdsRef.current : [id];
      const group = expandGroups(base, allPositions);
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

      // Fantômes type Canva : clones flottants (position fixed, hors de tout
      // conteneur `overflow:hidden`) qui suivent le curseur d'une page à l'autre.
      // L'élément réel reste en place, estompé, comme repère d'origine.
      const ghosts: HTMLElement[] = [];
      for (const b of blocks) {
        const rect = b.el.getBoundingClientRect();
        const ghost = b.el.cloneNode(true) as HTMLElement;
        // Garde UNIQUEMENT le wrapper [data-block-content] (le vrai contenu) ;
        // retire le hover-indicator, le label, l'icône de verrou et les
        // poignées de resize. Avant : on gardait l'enfant d'index 0, ce qui
        // tombait sur le hover-indicator quand le bloc n'était pas
        // sélectionné avant le clic → ghost tout blanc et vide.
        Array.from(ghost.children).forEach((child) => {
          if (!(child as HTMLElement).hasAttribute("data-block-content")) {
            child.remove();
          }
        });
        Object.assign(ghost.style, {
          position: "fixed",
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          margin: "0",
          pointerEvents: "none",
          zIndex: "9999",
          opacity: "0.97",
          transform: "translate(0px, 0px)",
          background: "#ffffff",
          borderRadius: "3px",
          boxShadow: `0 0 0 1px ${SELECTION_COLOR}, 0 10px 28px rgba(0,0,0,0.22)`,
          willChange: "transform",
        } as Partial<CSSStyleDeclaration>);
        document.body.appendChild(ghost);
        ghosts.push(ghost);
        // Original légèrement estompé (repère d'origine) mais le contenu reste
        // LISIBLE — y compris sur une sidebar avec un fond coloré, où 0.25
        // donnait l'impression que le bloc disparaissait derrière la sidebar.
        b.el.style.opacity = "0.5";
      }

      // ── Pivot curseur (drop inter-pages) ────────────────────────────────
      // On mémorise le décalage du curseur DANS le bloc pivot, et la position
      // de chaque membre du groupe RELATIVE au pivot (en px écran). Au drop sur
      // une autre page, on repose le groupe sous le curseur → aucun saut.
      const primaryRect = (blocks.find((b) => b.blockId === id)?.el ?? blocks[0]?.el)?.getBoundingClientRect();
      const grab: GrabOffset = primaryRect
        ? { dx: startMouseX - primaryRect.left, dy: startMouseY - primaryRect.top }
        : { dx: 0, dy: 0 };
      const members: DropMember[] = primaryRect
        ? blocks.map((b) => {
            const r = b.el.getBoundingClientRect();
            return { id: b.blockId, relLeft: r.left - primaryRect.left, relTop: r.top - primaryRect.top };
          })
        : blocks.map((b) => ({ id: b.blockId, relLeft: 0, relTop: 0 }));

      // Candidats au snap : tous les blocs HORS groupe, sur la même page, avec
      // leur hauteur MESURÉE (snapshot — invariante pendant le geste).
      const groupSet = new Set(group);
      const dragPage = currentPos.page ?? 0;
      const candidates: SnapRect[] = [];
      for (const [k, v] of Object.entries(allPositions)) {
        if (groupSet.has(k)) continue;
        if ((v.page ?? 0) !== dragPage) continue;
        const cel = document.querySelector(`[data-block-id="${k}"]`) as HTMLElement | null;
        const h = v.h ?? (cel ? cel.offsetHeight / PT_TO_PX : 20);
        candidates.push({ id: k, x: v.x, y: v.y, w: v.w ?? 150, h });
      }

      const dragW = currentPos.w ?? 150;
      const dragEl = blocks.find((b) => b.blockId === id)?.el ?? null;
      const dragH = currentPos.h ?? (dragEl ? dragEl.offsetHeight / PT_TO_PX : 20);

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
          const { guides, snappedX, snappedY } = findSnapGuides(
            { id, x: rawX, y: rawY, w: dragW, h: dragH },
            candidates
          );

          const clampedX = Math.max(0, Math.min(A4_WIDTH_PT - dragW, snappedX));
          const clampedY = Math.max(0, snappedY);
          pendingDx = clampedX - currentPos.x;
          pendingDy = clampedY - currentPos.y;

          // Les fantômes suivent le curseur en pixels écran (1:1) → visibles
          // même au-dessus d'une autre page, comme dans Canva.
          const screenDx = moveEvent.clientX - startMouseX;
          const screenDy = moveEvent.clientY - startMouseY;
          for (const g of ghosts) g.style.transform = `translate(${screenDx}px, ${screenDy}px)`;
          setSnapGuides(guides);
        });
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        if (rafId) cancelAnimationFrame(rafId);
        for (const g of ghosts) g.remove();
        for (const b of blocks) {
          b.el.style.willChange = "";
          b.el.style.zIndex = "";
          b.el.style.opacity = "";
        }
        setIsDragging(false);
        setSnapGuides([]);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);

        // Drop sur une autre page → l'appelant déplace le(s) bloc(s) sélectionné(s)
        // et fixe leurs positions (pivot = curseur) ; on n'écrit pas les
        // coordonnées du drag.
        if (resolveDropRef?.current?.(id, upEvent.clientX, upEvent.clientY, grab, members)) return;

        const updates: Record<string, BlockPos> = {};
        for (const b of blocks) {
          updates[b.blockId] = {
            ...b.pos,
            x: Math.max(0, Math.round(b.pos.x + pendingDx)),
            y: Math.max(0, Math.round(b.pos.y + pendingDy)),
          };
        }
        commitPositions(updates, id);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [commitPositions, mouseDeltaToPts, resolveSavedPos, toggleSelect, resolveDropRef]
  );

  const startResize = useCallback(
    (e: React.MouseEvent, id: string, currentPos: BlockPos, edge: ResizeEdge) => {
      e.preventDefault();
      e.stopPropagation();
      if (currentPos.locked) return;
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
      // Resize diagonal (coin) : le texte suit la largeur via fontScale.
      // Resize latéral/vertical : conteneur seul, comportement inchangé.
      const isCorner = resizesW && resizesH;
      const startFontScale = currentPos.fontScale ?? 1;
      let pendingFontScale = startFontScale;

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

          if (isCorner && startW > 0) {
            pendingFontScale = Math.max(0.4, Math.min(3, startFontScale * (pendingW / startW)));
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
            if (isCorner) {
              // Aperçu live : zoom CSS sur le contenu (commité en fontScale au mouseup)
              const content = blockEl.firstElementChild as HTMLElement | null;
              if (content) content.style.zoom = String(pendingFontScale / startFontScale);
            }
          }
        });
      };

      const handleMouseUp = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (blockEl) {
          blockEl.style.willChange = "";
          const content = blockEl.firstElementChild as HTMLElement | null;
          if (content) content.style.zoom = "";
        }
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
            ...(isCorner ? { fontScale: Math.round(pendingFontScale * 100) / 100 } : {}),
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
