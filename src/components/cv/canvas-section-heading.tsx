"use client";

import React from "react";
import { Plus, Minus } from "lucide-react";
import { EditableText, ptsToPx } from "./cv-canvas-primitives";

interface CanvasSectionHeadingProps {
  title: string;
  blockId: string;
  headingFontSize: number;
  primaryColor: string;
  onFontSizeChange: (size: number) => void;
  /** Renommage du titre de section (édition inline). */
  onTitleChange?: (title: string) => void;
}

export const CanvasSectionHeading = React.memo(function CanvasSectionHeading({
  title,
  blockId,
  headingFontSize,
  primaryColor,
  onFontSizeChange,
  onTitleChange,
}: CanvasSectionHeadingProps) {
  return (
    <h2
      className="font-bold border-b border-zinc-300 uppercase tracking-wide group/h2 select-none relative flex items-center w-full"
      data-block-id={blockId}
      style={{
        fontSize: ptsToPx(headingFontSize),
        color: primaryColor,
        borderBottomColor: primaryColor,
        // Espacements convertis depuis les points du PDF (h2 : marginBottom 2pt,
        // paddingBottom 1pt) au lieu de pixels bruts (6px / 2px), qui allouaient
        // ~2,25× trop d'espace sous chaque titre.
        marginBottom: ptsToPx(2),
        paddingBottom: ptsToPx(1),
        lineHeight: 1.15,
      }}
    >
      {onTitleChange ? (
        <EditableText
          value={title}
          onChange={onTitleChange}
          placeholder="Titre de section"
          className="uppercase tracking-wide"
          style={{ color: primaryColor }}
        />
      ) : (
        title
      )}
      {/* Réglage de la taille du titre : ancré DANS le titre, à son extrémité
          droite. Placé hors du bloc (`left-full`), il débordait de la colonne et
          était rogné par le bord de la page : on ne voyait qu'un « − » coupé. */}
      <span
        data-no-print
        title="Taille de ce titre (tous les titres : panneau Thème)"
        className="pointer-events-none absolute right-0 top-1/2 z-30 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-popover px-0.5 py-0.5 text-[10px] font-medium normal-case leading-none tracking-normal text-popover-foreground opacity-0 shadow-sm transition-opacity duration-150 select-none group-hover/h2:pointer-events-auto group-hover/h2:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100"
      >
        <button
          type="button"
          aria-label="Réduire ce titre"
          onClick={() => onFontSizeChange(Math.max(9, headingFontSize - 0.5))}
          className="flex size-4 items-center justify-center rounded hover:bg-muted"
        >
          <Minus size={10} />
        </button>
        <span className="min-w-8 text-center tabular-nums">{headingFontSize}pt</span>
        <button
          type="button"
          aria-label="Agrandir ce titre"
          onClick={() => onFontSizeChange(Math.min(18, headingFontSize + 0.5))}
          className="flex size-4 items-center justify-center rounded hover:bg-muted"
        >
          <Plus size={10} />
        </button>
      </span>
    </h2>
  );
});
