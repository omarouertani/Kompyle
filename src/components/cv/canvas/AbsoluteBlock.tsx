"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ptsToPx } from "../cv-canvas-primitives";
import type { BlockPos } from "./snap";
import type { ResizeEdge } from "./use-canvas-interactions";

const HANDLES: Array<{ edge: ResizeEdge; cursor: string; cls: string }> = [
  { edge: "e", cursor: "ew-resize", cls: "right-0 top-1/2 -translate-y-1/2 w-2 h-6 translate-x-1/2" },
  { edge: "w", cursor: "ew-resize", cls: "left-0 top-1/2 -translate-y-1/2 w-2 h-6 -translate-x-1/2" },
  { edge: "n", cursor: "ns-resize", cls: "top-0 left-1/2 -translate-x-1/2 h-2 w-6 -translate-y-1/2" },
  { edge: "s", cursor: "ns-resize", cls: "bottom-0 left-1/2 -translate-x-1/2 h-2 w-6 translate-y-1/2" },
  { edge: "nw", cursor: "nwse-resize", cls: "top-0 left-0 w-3 h-3 -translate-x-1/2 -translate-y-1/2" },
  { edge: "ne", cursor: "nesw-resize", cls: "top-0 right-0 w-3 h-3 translate-x-1/2 -translate-y-1/2" },
  { edge: "sw", cursor: "nesw-resize", cls: "bottom-0 left-0 w-3 h-3 -translate-x-1/2 translate-y-1/2" },
  { edge: "se", cursor: "nwse-resize", cls: "bottom-0 right-0 w-3 h-3 translate-x-1/2 translate-y-1/2" },
];

interface AbsoluteBlockProps {
  id: string;
  pos: BlockPos;
  isSelected: boolean;
  isInteracting: boolean;
  onDragStart: (e: React.MouseEvent, id: string, pos: BlockPos) => void;
  onResizeStart: (e: React.MouseEvent, id: string, pos: BlockPos, edge: ResizeEdge) => void;
  onResetHeight?: (id: string, pos: BlockPos) => void;
  onContextMenu?: (e: React.MouseEvent, id: string) => void;
  children: React.ReactNode;
}

/** Bloc positionné en absolu avec sélection type Canva :
 *  ring + 8 poignées de redimensionnement (largeur, hauteur, diagonales)
 *  + tooltip de coordonnées. Double-clic sur une poignée → hauteur auto. */
export function AbsoluteBlock({
  id,
  pos,
  isSelected,
  isInteracting,
  onDragStart,
  onResizeStart,
  onResetHeight,
  onContextMenu,
  children,
}: AbsoluteBlockProps) {
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
      }}
      className={cn(
        "group/abs rounded transition-shadow duration-100",
        isSelected
          ? "ring-2 ring-primary shadow-lg"
          : "border border-transparent hover:border-primary/30 hover:shadow-sm",
        !isInteracting && "cursor-move"
      )}
      onMouseDown={(e) => onDragStart(e, id, pos)}
      onContextMenu={(e) => onContextMenu?.(e, id)}
    >
      <div className="p-1">{children}</div>

      {isSelected && HANDLES.map(({ edge, cursor, cls }) => (
        <div
          key={edge}
          className={cn("absolute bg-primary rounded-sm z-40", cls)}
          style={{ cursor }}
          onMouseDown={(e) => onResizeStart(e, id, pos, edge)}
          onDoubleClick={() => onResetHeight?.(id, pos)}
          title="Glisser pour redimensionner · double-clic : hauteur auto"
        />
      ))}

      {isSelected && (
        <div className="absolute -top-5 left-0 flex items-center gap-2 bg-zinc-900/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded z-50 select-none pointer-events-none whitespace-nowrap">
          X:{Math.round(pos.x)} Y:{Math.round(pos.y)}
          {pos.w ? ` W:${Math.round(pos.w)}` : ""}
          {pos.h ? ` H:${Math.round(pos.h)}` : ""}
        </div>
      )}
    </div>
  );
}
