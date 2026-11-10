"use client";

import { useEffect } from "react";
import type { CVData, CVLayout } from "@/types/cv";
import type { BlockPos } from "./snap";
import { isSectionBlock } from "./block-helpers";

interface UseKeyboardShortcutsArgs {
  selectedIds: string[];
  layout: CVLayout;
  data: CVData;
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData, coalesceKey?: string) => void;
  hideSectionOf: (blockId: string) => void;
  clearSelection: () => void;
  canDuplicate: (blockId: string) => boolean;
  duplicateItem: (blockId: string) => void;
  /** Un bloc représente-t-il un ÉLÉMENT supprimable individuellement ? */
  canDeleteBlock: (blockId: string) => boolean;
  /** Supprime UNIQUEMENT l'élément (jamais la section entière). */
  deleteBlock: (blockId: string) => void;
  undo: () => void;
  redo: () => void;
  fitToScreen: () => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
}

/** Raccourcis clavier : Ctrl+Z/Y (undo/redo), Ctrl+0 (ajuster), Ctrl+G /
 *  Ctrl+Shift+G (grouper/dégrouper), Échap, Suppr (masquer), Ctrl+D (dupliquer),
 *  flèches (déplacer la sélection). */
export function useKeyboardShortcuts({
  selectedIds,
  layout,
  data,
  defaultPositions,
  onChange,
  hideSectionOf,
  clearSelection,
  canDuplicate,
  duplicateItem,
  canDeleteBlock,
  deleteBlock,
  undo,
  redo,
  fitToScreen,
  groupSelected,
  ungroupSelected,
}: UseKeyboardShortcutsArgs) {
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

      // Ctrl/Cmd + 0 → « Ajuster à la largeur visible » (actif sans sélection)
      if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        if (isEditingText) return;
        e.preventDefault();
        fitToScreen();
        return;
      }

      if (selectedIds.length === 0) return;
      if (isEditingText) return;

      // Ctrl/Cmd + G → grouper · Ctrl/Cmd + Shift + G → dégrouper
      if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        // Priorité à la suppression d'un ÉLÉMENT individuel (une expérience, une
        // compétence, une formation, un contenu optionnel…) — jamais la section
        // entière. Avant, tout élément sélectionné masquait toute sa section car
        // `isSectionBlock` est vrai pour un item comme pour un titre.
        const deletable = selectedIds.find(canDeleteBlock);
        if (deletable) {
          deleteBlock(deletable);
          clearSelection();
          return;
        }
        // Sinon (un TITRE de section sélectionné, un contenu non-supprimable) :
        // masquer la section parente. Une seule par appel (chaque appel commit).
        const section = selectedIds.find(isSectionBlock);
        if (section) hideSectionOf(section);
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
      // Fusion défauts + sauvegardées : un bloc SANS position sauvegardée (ex.
      // section libre fraîchement ajoutée) doit rester déplaçable même si
      // d'autres blocs en ont une. Avant, `?? defaultPositions` ignorait les
      // défauts dès qu'UNE position était sauvegardée → flèches inopérantes.
      const positions: Record<string, BlockPos> = { ...defaultPositions, ...(layout.absolutePositions ?? {}) };
      const updates: Record<string, BlockPos> = {};
      for (const id of selectedIds) {
        const pos = positions[id];
        if (pos && !pos.locked) updates[id] = { ...pos, x: Math.max(0, pos.x + dx), y: Math.max(0, pos.y + dy) };
      }
      if (Object.keys(updates).length === 0) return;
      onChange({
        ...data,
        // autoPaginated:false → l'utilisateur a pris la main : la re-pagination
        // automatique ne réécrasera plus son placement (cf. use-canvas-pagination).
        layout: { ...layout, autoPaginated: false, absolutePositions: { ...positions, ...updates } },
      }, "move");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, layout, data, defaultPositions, onChange, hideSectionOf, clearSelection, canDuplicate, duplicateItem, canDeleteBlock, deleteBlock, undo, redo, fitToScreen, groupSelected, ungroupSelected]);
}
