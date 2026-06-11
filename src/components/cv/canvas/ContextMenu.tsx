"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  label: string;
  icon?: React.ElementType;
  danger?: boolean;
  /** Ligne de séparation au-dessus de l'item. */
  separator?: boolean;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Menu contextuel léger (clic droit) — se ferme sur clic extérieur ou Échap. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Garde le menu dans le viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, typeof window !== "undefined" ? window.innerWidth - 230 : x),
    top: Math.min(y, typeof window !== "undefined" ? window.innerHeight - items.length * 36 - 16 : y),
    zIndex: 100,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="min-w-[210px] bg-popover border border-border rounded-lg shadow-lg p-1 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {item.separator && <div className="h-px bg-border/60 my-1 mx-1" />}
          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md text-left transition-colors",
              item.danger
                ? "text-destructive hover:bg-destructive/10"
                : "text-foreground hover:bg-muted"
            )}
            onClick={() => {
              item.onClick();
              onClose();
            }}
          >
            {item.icon && <item.icon size={13} className="shrink-0 opacity-70" />}
            {item.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
