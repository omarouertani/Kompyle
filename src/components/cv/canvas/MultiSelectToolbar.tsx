"use client";

import React, { useRef } from "react";
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
  Bold,
  Italic,
  ChevronDown,
} from "lucide-react";
import type { CVFontFamily } from "@/types/cv";
import { FONT_FAMILIES } from "./ThemePanel";

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
  /** Applique une couleur à tout le texte des blocs sélectionnés. */
  onApplyColor?: (color: string) => void;
  /** Applique une police à tout le texte des blocs sélectionnés. */
  onApplyFont?: (stack: string) => void;
  /** Bascule gras/italique sur tout le texte des blocs sélectionnés. */
  onToggle?: (command: "bold" | "italic") => void;
  /** Au moins un bloc sélectionné expose-t-il du texte formatable ? */
  canFormat?: boolean;
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
export function MultiSelectToolbar({ count, hasGroup, onAlign, onGroup, onUngroup, onApplyColor, onApplyFont, onToggle, canFormat }: MultiSelectToolbarProps) {
  const t = useTranslations("Canvas");
  if (count < 2) return null;

  const showFormat = !!onApplyColor && !!onApplyFont && !!onToggle && !!canFormat;

  return (
    <div
      data-canvas-toolbar
      className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 bg-background/95 backdrop-blur-md p-0.5 rounded-lg border border-border/80 shadow-lg"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="px-1.5 text-[10px] font-semibold text-muted-foreground tabular-nums">{count}</span>
      <div className="w-px h-4 bg-border/60 mx-0.5" />
      {showFormat && (
        <>
          <SelectionFontPicker onPick={(stack) => onApplyFont!(stack)} title={t("ms_apply_font")} />
          <SelectionColorButton onPick={(c) => onApplyColor!(c)} title={t("ms_apply_color")} />
          <Btn onClick={() => onToggle!("bold")} title={t("ms_apply_bold")}><Bold size={13} strokeWidth={2.5} /></Btn>
          <Btn onClick={() => onToggle!("italic")} title={t("ms_apply_italic")}><Italic size={13} strokeWidth={2.5} /></Btn>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
        </>
      )}
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

/** Sélecteur de police compact pour la multi-sélection (applique à tous). */
function SelectionFontPicker({ onPick, title }: { onPick: (stack: string) => void; title: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className="h-6 px-1.5 flex items-center gap-1 rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors text-[11px] font-semibold"
      >
        Aa<ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-7 z-40 w-40 max-h-60 overflow-y-auto rounded-xl border border-border/70 bg-popover shadow-xl p-1 scrollbar-thin">
            {(Object.entries(FONT_FAMILIES) as Array<[CVFontFamily, { label: string; stack: string }]>).map(([key, font]) => (
              <button
                key={key}
                type="button"
                onClick={() => { onPick(font.stack); setOpen(false); }}
                className="w-full px-2 py-1.5 rounded-md text-left text-xs text-foreground hover:bg-muted/60"
                style={{ fontFamily: font.stack }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Bouton couleur (sélecteur natif) pour la multi-sélection. */
function SelectionColorButton({ onPick, title }: { onPick: (color: string) => void; title: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        title={title}
        className="p-1 h-6 w-6 flex flex-col items-center justify-center rounded hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-[11px] font-bold leading-none">A</span>
        <span className="block h-[3px] w-3 rounded-sm bg-foreground" />
      </button>
      <input
        ref={ref}
        type="color"
        defaultValue="#000000"
        onChange={(e) => onPick(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}
