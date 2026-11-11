"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Type, Minus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FreeElementKind } from "@/types/cv";

const ITEMS: Array<{ kind: FreeElementKind; icon: React.ReactNode; key: "insert_text" | "insert_line" | "insert_rect" }> = [
  { kind: "text", icon: <Type size={12} />, key: "insert_text" },
  { kind: "line", icon: <Minus size={12} />, key: "insert_line" },
  { kind: "rect", icon: <Square size={12} />, key: "insert_rect" },
];

/** Bouton « Insérer » de la barre d'outils : ajoute un élément libre sur la
 *  page active. */
export function InsertMenu({ onInsert }: { onInsert: (kind: FreeElementKind) => void }) {
  const t = useTranslations("Canvas");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md transition-all shadow-sm h-6",
          open ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/80 text-foreground"
        )}
        title={t("insert")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={10} />
        <span className="hidden sm:inline">{t("insert")}</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-8 z-50 w-40 rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-xl p-1 flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ITEMS.map((it) => (
            <button
              key={it.kind}
              type="button"
              role="menuitem"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-muted/80"
              onClick={() => {
                setOpen(false);
                onInsert(it.kind);
              }}
            >
              {it.icon}
              {t(it.key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
