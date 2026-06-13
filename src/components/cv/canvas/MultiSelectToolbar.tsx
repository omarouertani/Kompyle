"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignVerticalSpaceAround,
  AlignHorizontalSpaceAround,
  Group,
  Ungroup,
} from "lucide-react";

export type AlignKind =
  | "left"
  | "centerH"
  | "right"
  | "top"
  | "middleV"
  | "bottom"
  | "distV"
  | "distH";

interface MultiSelectToolbarProps {
  count: number;
  /** La sélection contient-elle au moins un bloc groupé ? */
  hasGroup: boolean;
  onAlign: (kind: AlignKind) => void;
  onGroup: () => void;
  onUngroup: () => void;
}

function Btn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1 h-6 w-6 flex items-center justify-center rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
    >
      {children}
    </button>
  );
}

/** Barre flottante d'alignement / distribution / groupement, affichée dès que
 *  2 blocs (ou plus) sont sélectionnés ensemble (style Canva). */
export function MultiSelectToolbar({ count, hasGroup, onAlign, onGroup, onUngroup }: MultiSelectToolbarProps) {
  const t = useTranslations("Canvas");
  if (count < 2) return null;

  return (
    <div
      data-canvas-toolbar
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 bg-background/95 backdrop-blur-md p-0.5 rounded-lg border border-border/80 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums">{count}</span>
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      <Btn onClick={() => onAlign("left")} title={t("align_left")}><AlignStartVertical size={13} /></Btn>
      <Btn onClick={() => onAlign("centerH")} title={t("align_center_h")}><AlignCenterVertical size={13} /></Btn>
      <Btn onClick={() => onAlign("right")} title={t("align_right")}><AlignEndVertical size={13} /></Btn>
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      <Btn onClick={() => onAlign("top")} title={t("align_top")}><AlignStartHorizontal size={13} /></Btn>
      <Btn onClick={() => onAlign("middleV")} title={t("align_middle_v")}><AlignCenterHorizontal size={13} /></Btn>
      <Btn onClick={() => onAlign("bottom")} title={t("align_bottom")}><AlignEndHorizontal size={13} /></Btn>
      {count >= 3 && (
        <>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <Btn onClick={() => onAlign("distV")} title={t("distribute_v")}><AlignVerticalSpaceAround size={13} /></Btn>
          <Btn onClick={() => onAlign("distH")} title={t("distribute_h")}><AlignHorizontalSpaceAround size={13} /></Btn>
        </>
      )}
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      {hasGroup ? (
        <Btn onClick={onUngroup} title={t("ungroup_tooltip")}><Ungroup size={13} /></Btn>
      ) : (
        <Btn onClick={onGroup} title={t("group_tooltip")}><Group size={13} /></Btn>
      )}
    </div>
  );
}
