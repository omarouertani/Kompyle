"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { CVData, CVLayout } from "@/types/cv";
import { addCustomSection, getParentSectionId } from "@/lib/cv-layout";
import { Maximize2, MoveUpRight, MoveRight, Copy, EyeOff, RotateCcw, SquarePlus, Lock, LockOpen, Group, Ungroup } from "lucide-react";
import type { ContextMenuItem } from "./ContextMenu";
import type { BlockPos } from "./snap";
import { isSectionBlock } from "./block-helpers";

interface UseContextMenuArgs {
  data: CVData;
  layout: CVLayout;
  defaultPositions: Record<string, BlockPos>;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  onChange: (newData: CVData) => void;
  realign: () => void;
  autoHeight: (ids: string[]) => void;
  resetPosition: (ids: string[]) => void;
  canDuplicate: (blockId: string) => boolean;
  duplicateItem: (blockId: string) => void;
  hideSectionOf: (blockId: string) => void;
  selectionHasGroup: boolean | undefined;
  groupSelected: () => void;
  ungroupSelected: () => void;
  pageOfSection: (blockId: string) => number;
  moveSectionToPage: (blockId: string, targetPage: number) => void;
}

type Menu = { x: number; y: number; blockId: string | null } | null;

/** Menu contextuel du canvas : état d'ouverture, handlers clic-droit (bloc /
 *  fond), verrouillage, et génération de la liste d'items selon la cible. */
export function useContextMenu({
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
  hideSectionOf,
  selectionHasGroup,
  groupSelected,
  ungroupSelected,
  pageOfSection,
  moveSectionToPage,
}: UseContextMenuArgs) {
  const t = useTranslations("Canvas");
  const [menu, setMenu] = useState<Menu>(null);

  const savedPositions = useMemo(() => layout.absolutePositions ?? {}, [layout.absolutePositions]);

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

  const openBlockMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      // clic droit dans un texte en édition → menu natif (coller, etc.)
      if ((e.target as HTMLElement).closest("[contenteditable]")) return;
      e.preventDefault();
      e.stopPropagation();
      if (!selectedIds.includes(id)) setSelectedIds([id]);
      setMenu({ x: e.clientX, y: e.clientY, blockId: id });
    },
    [selectedIds, setSelectedIds]
  );

  const openCanvasMenu = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-block-id]")) return;
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, blockId: null });
  }, []);

  const menuItems = useCallback((): ContextMenuItem[] => {
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
    // Grouper / dégrouper la multi-sélection
    if (selectionHasGroup) {
      items.push({ label: t("menu_ungroup"), icon: Ungroup, onClick: ungroupSelected });
    } else if (targets.length >= 2) {
      items.push({ label: t("menu_group"), icon: Group, onClick: groupSelected });
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
  }, [menu, selectedIds, t, onChange, data, realign, savedPositions, defaultPositions, autoHeight, resetPosition, toggleLock, canDuplicate, duplicateItem, selectionHasGroup, ungroupSelected, groupSelected, layout.pages, pageOfSection, moveSectionToPage, hideSectionOf, clearSelection]);

  return { menu, setMenu, openBlockMenu, openCanvasMenu, menuItems };
}
