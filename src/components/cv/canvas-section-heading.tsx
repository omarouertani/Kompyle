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
      <span className="opacity-0 group-hover/h2:opacity-100 absolute left-full ml-2 flex items-center bg-background border rounded px-1 py-0.5 text-[10px] font-normal tracking-normal text-muted-foreground z-30 select-none">
        <button type="button" onClick={() => onFontSizeChange(Math.max(9, headingFontSize - 0.5))} className="p-0.5 hover:bg-muted rounded"><Minus size={10} /></button>
        <span className="mx-1">{headingFontSize}pt</span>
        <button type="button" onClick={() => onFontSizeChange(Math.min(18, headingFontSize + 0.5))} className="p-0.5 hover:bg-muted rounded"><Plus size={10} /></button>
      </span>
    </h2>
  );
});
