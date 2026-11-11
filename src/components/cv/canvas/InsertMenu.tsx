"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Type, Minus, Square, Circle, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FreeElementKind } from "@/types/cv";
import { resizeImageToDataUrl } from "@/utils/resize-image";
import { MAX_FREE_IMAGE_CHARS } from "@/lib/free-elements";

type InsertKey = "insert_text" | "insert_line" | "insert_rect" | "insert_ellipse" | "insert_image";
const ITEMS: Array<{ kind: FreeElementKind; icon: React.ReactNode; key: InsertKey }> = [
  { kind: "text", icon: <Type size={12} />, key: "insert_text" },
  { kind: "line", icon: <Minus size={12} />, key: "insert_line" },
  { kind: "rect", icon: <Square size={12} />, key: "insert_rect" },
  { kind: "ellipse", icon: <Circle size={12} />, key: "insert_ellipse" },
  { kind: "image", icon: <ImagePlus size={12} />, key: "insert_image" },
];

export interface InsertedImage {
  src: string;
  width: number;
  height: number;
}

/** Image choisie → data URL réduite (PNG gardé si possible pour la transparence,
 *  sinon JPEG), sous `MAX_FREE_IMAGE_CHARS`. Rejette si impossible. */
async function prepareImage(file: File): Promise<InsertedImage> {
  const attempts: Array<[number, number, "png" | "jpeg"]> = [
    ...(file.type === "image/png" ? ([[800, 1, "png"]] as Array<[number, number, "png"]>) : []),
    [1000, 0.85, "jpeg"],
    [700, 0.8, "jpeg"],
  ];
  let src = "";
  for (const [side, q, fmt] of attempts) {
    src = await resizeImageToDataUrl(file, side, q, fmt);
    if (src.length <= MAX_FREE_IMAGE_CHARS) break;
  }
  if (src.length > MAX_FREE_IMAGE_CHARS) throw new Error("Image too large");
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("decode"));
    img.src = src;
  });
  return { src, width: img.naturalWidth, height: img.naturalHeight };
}

/** Bouton « Insérer » de la barre d'outils : ajoute un élément libre sur la
 *  page active. */
export function InsertMenu({ onInsert }: { onInsert: (kind: FreeElementKind, image?: InsertedImage) => void }) {
  const t = useTranslations("Canvas");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      onInsert("image", await prepareImage(file));
    } catch {
      toast.error(t("insert_image_error"));
    }
  };

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
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
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
                if (it.kind === "image") fileRef.current?.click();
                else onInsert(it.kind);
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
