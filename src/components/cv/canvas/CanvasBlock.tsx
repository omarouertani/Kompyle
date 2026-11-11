"use client";

import React from "react";
import type { CVData } from "@/types/cv";
import { AbsoluteBlock } from "./AbsoluteBlock";
import { useTranslations } from "next-intl";
import { BlockContent, type BlockTheme } from "./BlockContent";
import { FreeElementContent } from "./FreeElementContent";
import { isFreeElementId } from "@/lib/free-elements";
import type { BlockPos } from "./snap";
import type { ResizeEdge } from "./use-canvas-interactions";

interface CanvasBlockProps {
  id: string;
  /** Position déjà résolue (défaut + sauvegarde + cas photo / nouveau bloc). */
  pos: BlockPos;
  isSelected: boolean;
  isInteracting: boolean;
  /** Rang de superposition sur la page. */
  rank: number;
  label: string;
  /** Thème de base ; l'échelle de police (resize diagonal) est appliquée ici. */
  blockTheme: BlockTheme;
  data: CVData;
  onChange: (newData: CVData) => void;
  onDragStart: (e: React.MouseEvent, id: string, pos: BlockPos) => void;
  onResizeStart: (e: React.MouseEvent, id: string, pos: BlockPos, edge: ResizeEdge) => void;
  autoHeight: (ids: string[]) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  /** Réaligne en préservant le placement manuel (taille de titre par section). */
  onThemeReflow?: () => void;
}

/** Un bloc unique du canvas : conteneur déplaçable / redimensionnable
 *  (AbsoluteBlock) + son contenu (BlockContent), avec application de l'échelle
 *  de police issue d'un resize diagonal. */
export function CanvasBlock({
  id,
  pos,
  isSelected,
  isInteracting,
  rank,
  label,
  blockTheme,
  data,
  onChange,
  onDragStart,
  onResizeStart,
  autoHeight,
  onContextMenu,
  onThemeReflow,
}: CanvasBlockProps) {
  const t = useTranslations("Canvas");
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
  const freeEl = isFreeElementId(id) ? data.layout?.freeElements?.find((f) => f.id === id) : undefined;
  // Zone de texte libre non sélectionnée : un clic hors des lettres traverse
  // vers une ligne libre placée dessous (sinon la ligne, fine, devient
  // impossible à attraper).
  const handleDragStart = (e: React.MouseEvent, blockId: string, p: BlockPos) => {
    if (!isSelected && freeEl?.kind === "text" && freeEl.html && passClickToLineBelow(e)) return;
    onDragStart(e, blockId, p);
  };
  return (
    <AbsoluteBlock
      id={id}
      pos={pos}
      isSelected={isSelected}
      isInteracting={isInteracting}
      rank={rank}
      freeKind={freeEl?.kind}
      label={label}
      onDragStart={handleDragStart}
      onResizeStart={onResizeStart}
      onResetHeight={(blockId) => autoHeight([blockId])}
      onContextMenu={onContextMenu}
    >
      {isFreeElementId(id) ? (() => {
        const el = data.layout?.freeElements?.find((f) => f.id === id);
        return el ? (
          <FreeElementContent
            el={el}
            pos={pos}
            data={data}
            baseFontSize={blockTheme.baseFontSize}
            lineHeight={blockTheme.lineHeight}
            placeholder={t("free_text_placeholder")}
            onChange={onChange}
          />
        ) : null;
      })() : (
        <BlockContent blockId={id} data={data} theme={themeForBlock} onChange={onChange} onThemeReflow={onThemeReflow} />
      )}
    </AbsoluteBlock>
  );
}

/** Vrai si le point (x, y) tombe sur les lettres de `el` (marge de 1 px). */
function isOverText(el: Element, x: number, y: number): boolean {
  // Nœud texte par nœud texte : un Range sur l'élément entier renverrait aussi
  // la boîte de l'éditeur (toute la largeur de la zone).
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    range.selectNodeContents(n);
    const hit = Array.from(range.getClientRects()).some(
      (r) => x >= r.left - 1 && x <= r.right + 1 && y >= r.top - 1 && y <= r.bottom + 1,
    );
    if (hit) return true;
  }
  return false;
}

/**
 * Si le clic tombe hors des lettres d'une zone de texte et qu'une ligne libre
 * est dessous, renvoie le clic à la ligne et retourne vrai.
 */
function passClickToLineBelow(e: React.MouseEvent): boolean {
  const box = e.currentTarget as HTMLElement;
  const content = box.querySelector("[data-block-content]");
  if (!content || isOverText(content, e.clientX, e.clientY)) return false;
  const prev = box.style.pointerEvents;
  box.style.pointerEvents = "none";
  const below = document.elementFromPoint(e.clientX, e.clientY);
  box.style.pointerEvents = prev;
  const target = below?.closest<HTMLElement>("[data-free-kind='line']");
  if (!below || !target) return false;
  e.preventDefault();
  e.stopPropagation();
  below.dispatchEvent(
    new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    }),
  );
  return true;
}
