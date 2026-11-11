"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Type, Minus, Square, Circle, ImagePlus, Shapes, ChevronLeft, Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toolbarPill } from "./toolbar-styles";
import type { FreeElementKind } from "@/types/cv";
import { resizeImageToDataUrl } from "@/utils/resize-image";
import { MAX_FREE_IMAGE_CHARS } from "@/lib/free-elements";
import { CV_ICON_NAMES, cvIconNode, type CvIconName } from "@/lib/cv-icons";

type InsertKey = "insert_text" | "insert_line" | "insert_rect" | "insert_ellipse" | "insert_image" | "insert_icon";
const ITEMS: Array<{ kind: FreeElementKind; icon: React.ReactNode; key: InsertKey }> = [
  { kind: "text", icon: <Type size={12} />, key: "insert_text" },
  { kind: "line", icon: <Minus size={12} />, key: "insert_line" },
  { kind: "rect", icon: <Square size={12} />, key: "insert_rect" },
  { kind: "ellipse", icon: <Circle size={12} />, key: "insert_ellipse" },
  { kind: "image", icon: <ImagePlus size={12} />, key: "insert_image" },
  { kind: "icon", icon: <Shapes size={12} />, key: "insert_icon" },
];

export interface InsertedImage {
  src: string;
  width: number;
  height: number;
}

export type InsertHandler = (kind: FreeElementKind, image?: InsertedImage, iconName?: CvIconName) => void;

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
export function InsertMenu({ onInsert }: { onInsert: InsertHandler }) {
  const t = useTranslations("Canvas");
  const [open, setOpenState] = useState(false);
  // Grille des icônes affichée à la place de la liste.
  const [iconsOpen, setIconsOpen] = useState(false);
  const setOpen = (next: boolean | ((o: boolean) => boolean)) => {
    setOpenState(next);
    setIconsOpen(false);
  };
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
      if (!ref.current?.contains(e.target as Node)) setOpenState(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenState(false);
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
        className={toolbarPill(open)}
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
          className={cn(
            "absolute left-0 top-8 z-50 rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-xl p-1 flex flex-col",
            iconsOpen ? "w-52" : "w-40"
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {iconsOpen ? (
            <>
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-left hover:bg-muted/80"
                onClick={() => setIconsOpen(false)}
              >
                <ChevronLeft size={12} />
                {t("insert_icon")}
              </button>
              <div className="grid grid-cols-6 gap-0.5 p-1">
                {CV_ICON_NAMES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="menuitem"
                    title={t(`icon_names.${name}`)}
                    aria-label={t(`icon_names.${name}`)}
                    className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted/80"
                    onClick={() => {
                      setOpen(false);
                      onInsert("icon", undefined, name);
                    }}
                  >
                    <Icon iconNode={cvIconNode(name) ?? []} size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : ITEMS.map((it) => (
            <button
              key={it.kind}
              type="button"
              role="menuitem"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-left hover:bg-muted/80"
              onClick={() => {
                if (it.kind === "icon") return setIconsOpen(true);
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
