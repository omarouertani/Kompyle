"use client";

import React from "react";
import type { CVData, FreeElement } from "@/types/cv";
import { EditableText, ptsToPx } from "../cv-canvas-primitives";
import { isSafeImageSrc, isVerticalLine } from "@/lib/free-elements";
import type { BlockPos } from "./snap";

interface FreeElementContentProps {
  el: FreeElement;
  pos: BlockPos;
  data: CVData;
  baseFontSize: number;
  lineHeight: number;
  placeholder: string;
  onChange: (newData: CVData) => void;
}

/** Contenu d'un élément libre dans le canvas (même géométrie que le PDF). */
export function FreeElementContent({ el, pos, data, baseFontSize, lineHeight, placeholder, onChange }: FreeElementContentProps) {
  const w = pos.w ?? el.w;
  const h = pos.h ?? el.h;

  if (el.kind === "line") {
    const t = Math.max(0.25, el.strokeWidth ?? 1.5);
    const vertical = isVerticalLine(w, h);
    return (
      <div className="relative" style={{ height: ptsToPx(h) }}>
        <div
          className="absolute"
          style={{
            backgroundColor: el.color ?? "#1a1a1a",
            ...(vertical
              ? { left: ptsToPx((w - t) / 2), top: 0, width: ptsToPx(t), height: "100%" }
              : { top: ptsToPx((h - t) / 2), left: 0, height: ptsToPx(t), width: "100%" }),
          }}
        />
      </div>
    );
  }

  if (el.kind === "image") {
    return isSafeImageSrc(el.src) ? (
      // eslint-disable-next-line @next/next/no-img-element -- data URL locale, pas d'optimisation Next possible
      <img src={el.src} alt="" draggable={false} style={{ display: "block", width: "100%", height: ptsToPx(h), objectFit: "contain" }} />
    ) : (
      <div style={{ height: ptsToPx(h) }} className="bg-muted/40" />
    );
  }

  if (el.kind === "rect" || el.kind === "ellipse") {
    const sw = el.strokeWidth ?? 0;
    return (
      <div
        style={{
          height: ptsToPx(h),
          backgroundColor: el.fill && el.fill !== "transparent" ? el.fill : undefined,
          borderRadius: el.kind === "ellipse" ? "50%" : ptsToPx(el.radius ?? 0),
          border: sw > 0 ? `${ptsToPx(sw)} solid ${el.color ?? "#1a1a1a"}` : undefined,
          boxSizing: "border-box",
        }}
      />
    );
  }

  const update = (html: string) =>
    onChange({
      ...data,
      layout: {
        ...data.layout!,
        freeElements: (data.layout?.freeElements ?? []).map((f) => (f.id === el.id ? { ...f, html } : f)),
      },
    });
  return (
    <EditableText
      value={el.html ?? ""}
      onChange={update}
      multiline
      placeholder={placeholder}
      className="block select-text"
      style={{ fontSize: ptsToPx(baseFontSize * (pos.fontScale ?? 1)), lineHeight, color: el.color }}
    />
  );
}
