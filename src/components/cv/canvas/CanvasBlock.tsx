"use client";

import React from "react";
import type { CVData } from "@/types/cv";
import { AbsoluteBlock } from "./AbsoluteBlock";
import { BlockContent, type BlockTheme } from "./BlockContent";
import type { BlockPos } from "./snap";
import type { ResizeEdge } from "./use-canvas-interactions";

interface CanvasBlockProps {
  id: string;
  /** Position déjà résolue (défaut + sauvegarde + cas photo / nouveau bloc). */
  pos: BlockPos;
  isSelected: boolean;
  isInteracting: boolean;
  label: string;
  /** Thème de base ; l'échelle de police (resize diagonal) est appliquée ici. */
  blockTheme: BlockTheme;
  data: CVData;
  onChange: (newData: CVData) => void;
  onDragStart: (e: React.MouseEvent, id: string, pos: BlockPos) => void;
  onResizeStart: (e: React.MouseEvent, id: string, pos: BlockPos, edge: ResizeEdge) => void;
  autoHeight: (ids: string[]) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

/** Un bloc unique du canvas : conteneur déplaçable / redimensionnable
 *  (AbsoluteBlock) + son contenu (BlockContent), avec application de l'échelle
 *  de police issue d'un resize diagonal. */
export function CanvasBlock({
  id,
  pos,
  isSelected,
  isInteracting,
  label,
  blockTheme,
  data,
  onChange,
  onDragStart,
  onResizeStart,
  autoHeight,
  onContextMenu,
}: CanvasBlockProps) {
  // Resize diagonal : le texte du bloc suit l'échelle sauvegardée
  const fs = pos.fontScale ?? 1;
  let themeForBlock: BlockTheme =
    fs === 1
      ? blockTheme
      : {
          ...blockTheme,
          baseFontSize: blockTheme.baseFontSize * fs,
          headingFontSize: blockTheme.headingFontSize * fs,
        };
  // Photo : sa taille suit la largeur du bloc → redimensionnable aux coins.
  if (id === "photo" && pos.w) {
    themeForBlock = { ...themeForBlock, photoSize: pos.w };
  }
  return (
    <AbsoluteBlock
      id={id}
      pos={pos}
      isSelected={isSelected}
      isInteracting={isInteracting}
      label={label}
      onDragStart={onDragStart}
      onResizeStart={onResizeStart}
      onResetHeight={(blockId) => autoHeight([blockId])}
      onContextMenu={onContextMenu}
    >
      <BlockContent blockId={id} data={data} theme={themeForBlock} onChange={onChange} />
    </AbsoluteBlock>
  );
}
