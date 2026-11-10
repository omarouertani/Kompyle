"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

/** Côté de la zone de recadrage à l'écran (px) et de l'image produite (px). */
const VIEW = 260;
const OUTPUT = 600;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

interface Crop {
  zoom: number; // 1 = l'image couvre juste la zone
  dx: number;   // décalage horizontal du centre (px écran)
  dy: number;
}

/** Garde l'image entièrement sous la zone (pas de bande vide). */
function clampCrop(c: Crop, w: number, h: number): Crop {
  const s = (VIEW / Math.min(w, h)) * c.zoom;
  const maxX = Math.max(0, (w * s - VIEW) / 2);
  const maxY = Math.max(0, (h * s - VIEW) / 2);
  return { zoom: c.zoom, dx: Math.max(-maxX, Math.min(maxX, c.dx)), dy: Math.max(-maxY, Math.min(maxY, c.dy)) };
}

/** Exporte la zone visible en JPEG carré (fond blanc). Fonction pure, testable. */
export function cropToDataUrl(img: HTMLImageElement, crop: Crop, quality = 0.88): string {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const s = (VIEW / Math.min(w, h)) * crop.zoom;
  // Coin haut-gauche de l'image dans la zone (px écran) → rectangle source (px image).
  const left = VIEW / 2 - (w * s) / 2 + crop.dx;
  const top = VIEW / 2 - (h * s) / 2 + crop.dy;
  const sx = -left / s;
  const sy = -top / s;
  const side = VIEW / s;
  const canvas = document.createElement("canvas");
  const out = Math.min(OUTPUT, Math.round(side)) || OUTPUT;
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  return canvas.toDataURL("image/jpeg", quality);
}

interface PhotoCropDialogProps {
  /** Fichier choisi ; null = dialogue fermé. */
  file: File | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
  onError: () => void;
}

/** Recadrage carré de la photo de profil à l'import : glisser pour déplacer,
 *  curseur (ou molette) pour zoomer. Sortie : JPEG 600×600 max. */
export function PhotoCropDialog({ file, onCancel, onConfirm, onError }: PhotoCropDialogProps) {
  const t = useTranslations("Builder");
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, dx: 0, dy: 0 });
  const dragRef = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Charge l'image du fichier ; l'URL objet est libérée à la fermeture.
  useEffect(() => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > MAX_INPUT_BYTES) {
      onErrorRef.current();
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    let alive = true;
    image.onload = () => {
      if (!alive) return;
      setCrop({ zoom: 1, dx: 0, dy: 0 });
      setImg(image);
    };
    image.onerror = () => alive && onErrorRef.current();
    image.src = url;
    return () => {
      alive = false;
      URL.revokeObjectURL(url);
      setImg(null);
    };
  }, [file]);

  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  const scale = (VIEW / Math.min(w, h)) * crop.zoom;
  const update = (next: Crop) => setCrop(clampCrop(next, w, h));

  const confirm = () => {
    if (!img) return;
    try {
      onConfirm(cropToDataUrl(img, crop));
    } catch {
      onError();
    }
  };

  return (
    <AlertDialog open={!!file} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("photo_crop_title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("photo_crop_hint")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-lg bg-muted touch-none cursor-grab active:cursor-grabbing select-none"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={(e) => {
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              dragRef.current = { x: e.clientX, y: e.clientY, dx: crop.dx, dy: crop.dy };
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              update({ zoom: crop.zoom, dx: d.dx + e.clientX - d.x, dy: d.dy + e.clientY - d.y });
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            onWheel={(e) => update({ ...crop, zoom: Math.max(1, Math.min(4, crop.zoom - e.deltaY * 0.002)) })}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element -- aperçu local (URL objet)
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="absolute max-w-none pointer-events-none"
                style={{
                  width: w * scale,
                  height: h * scale,
                  left: VIEW / 2 - (w * scale) / 2 + crop.dx,
                  top: VIEW / 2 - (h * scale) / 2 + crop.dy,
                }}
              />
            )}
            {/* Repère du cadrage rond (la forme finale se règle dans le thème). */}
            <div className="absolute inset-0 rounded-full ring-[999px] ring-black/35 pointer-events-none" />
          </div>
          <label className="flex items-center gap-2 w-full text-xs text-muted-foreground">
            {t("photo_crop_zoom")}
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => update({ ...crop, zoom: Number(e.target.value) })}
              className="flex-1 accent-primary"
            />
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t("photo_crop_cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={!img}>{t("photo_crop_apply")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
