"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { ptsToPx, SELECTION_COLOR } from "../cv-canvas-primitives";
import type { BlockPos } from "./snap";
import type { ResizeEdge } from "./use-canvas-interactions";

/** Poignées de redimensionnement : barres fines sur les arêtes,
 *  petits carrés sur les coins (style Canva, épaisseur réduite). */
const HANDLES: Array<{ edge: ResizeEdge; cursor: string; cls: string; corner: boolean }> = [
  { edge: "e", cursor: "ew-resize", cls: "right-0 top-1/2 -translate-y-1/2 w-1 h-4 translate-x-1/2", corner: false },
  { edge: "w", cursor: "ew-resize", cls: "left-0 top-1/2 -translate-y-1/2 w-1 h-4 -translate-x-1/2", corner: false },
  { edge: "n", cursor: "ns-resize", cls: "top-0 left-1/2 -translate-x-1/2 h-1 w-4 -translate-y-1/2", corner: false },
  { edge: "s", cursor: "ns-resize", cls: "bottom-0 left-1/2 -translate-x-1/2 h-1 w-4 translate-y-1/2", corner: false },
  { edge: "nw", cursor: "nwse-resize", cls: "top-0 left-0 size-2 -translate-x-1/2 -translate-y-1/2", corner: true },
  { edge: "ne", cursor: "nesw-resize", cls: "top-0 right-0 size-2 translate-x-1/2 -translate-y-1/2", corner: true },
  { edge: "sw", cursor: "nesw-resize", cls: "bottom-0 left-0 size-2 -translate-x-1/2 translate-y-1/2", corner: true },
  { edge: "se", cursor: "nwse-resize", cls: "bottom-0 right-0 size-2 translate-x-1/2 translate-y-1/2", corner: true },
];

interface AbsoluteBlockProps {
  id: string;
  pos: BlockPos;
  isSelected: boolean;
  isInteracting: boolean;
  /** Nom de section affiché au survol du bloc. */
  label?: string;
  onDragStart: (e: React.MouseEvent, id: string, pos: BlockPos) => void;
  onResizeStart: (e: React.MouseEvent, id: string, pos: BlockPos, edge: ResizeEdge) => void;
  onResetHeight?: (id: string, pos: BlockPos) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  children: React.ReactNode;
}

/** Bloc positionné en absolu avec sélection type Canva :
 *  contour fin coloré + 8 poignées de redimensionnement (largeur, hauteur,
 *  diagonales). Double-clic sur une poignée → hauteur auto. */
export function AbsoluteBlock({
  id,
  pos,
  isSelected,
  isInteracting,
  label,
  onDragStart,
  onResizeStart,
  onResetHeight,
  onContextMenu,
  children,
}: AbsoluteBlockProps) {
  const locked = !!pos.locked;
  return (
    <div
      data-block-id={id}
      style={{
        position: "absolute",
        left: ptsToPx(pos.x),
        top: ptsToPx(pos.y),
        width: pos.w ? ptsToPx(pos.w) : undefined,
        // minHeight (et non height) : le contenu n'est jamais coupé
        minHeight: pos.h ? ptsToPx(pos.h) : undefined,
        zIndex: isSelected ? 30 : 10,
        // Contour fin et net (1px) — remplace l'ancien ring épais near-black
        boxShadow: isSelected ? `0 0 0 1px ${SELECTION_COLOR}` : undefined,
      }}
      className={cn(
        "group/abs rounded-[3px] transition-shadow duration-100",
        isSelected
          ? "shadow-md"
          : "border border-transparent hover:shadow-sm",
        !isInteracting && !locked && "cursor-move",
        locked && "cursor-default"
      )}
      onMouseDown={(e) => onDragStart(e, id, pos)}
      onContextMenu={(e) => onContextMenu?.(e, id)}
    >
      {!isSelected && (
        <div
          className="absolute inset-0 rounded-[3px] opacity-0 group-hover/abs:opacity-100 transition-opacity pointer-events-none"
          style={{ boxShadow: `0 0 0 1px ${SELECTION_COLOR}55` }}
        />
      )}

      {/* Label de section au survol (masqué pendant un drag/resize) */}
      {label && !isInteracting && (
        <div
          className={cn(
            "absolute -top-4 left-0 px-1 py-px rounded-sm text-[8px] font-semibold tracking-wide text-white pointer-events-none whitespace-nowrap z-50 transition-opacity flex items-center gap-0.5",
            isSelected ? "opacity-100" : "opacity-0 group-hover/abs:opacity-100"
          )}
          style={{ backgroundColor: SELECTION_COLOR }}
        >
          {locked && <Lock size={7} />}
          {label}
        </div>
      )}

      {/* Indicateur de verrou (sans label) */}
      {locked && !label && (
        <div
          className="absolute -top-4 right-0 p-0.5 rounded-sm text-white pointer-events-none z-50"
          style={{ backgroundColor: SELECTION_COLOR }}
        >
          <Lock size={7} />
        </div>
      )}

      {/* Aucun padding : le PDF place le contenu à (x, y, w) sans marge
          interne. Un p-1 réduisait la largeur utile de 8px → wrapping plus
          précoce et blocs plus hauts qu'en PDF (mesures de pagination faussées).
          data-block-content : sert au clonage « ghost » pendant le drag — on
          retrouve le wrapper exact (pas l'indicateur de hover ni le label). */}
      <div data-block-content>{children}</div>

      {isSelected && !locked && HANDLES.map(({ edge, cursor, cls, corner }) => (
        <div
          key={edge}
          className={cn("absolute z-40 rounded-[2px]", cls)}
          style={{
            cursor,
            backgroundColor: corner ? "#ffffff" : SELECTION_COLOR,
            border: corner ? `1px solid ${SELECTION_COLOR}` : undefined,
          }}
          onMouseDown={(e) => onResizeStart(e, id, pos, edge)}
          onDoubleClick={() => onResetHeight?.(id, pos)}
          title="Glisser pour redimensionner · double-clic : hauteur auto"
        />
      ))}
    </div>
  );
}
