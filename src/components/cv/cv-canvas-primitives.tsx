"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export const PT_TO_PX = 1.33;
export const A4_WIDTH_PX = 794;
export const A4_HEIGHT_PX = 1123;

export function ptsToPx(pts: number): string {
  return `${pts * PT_TO_PX}px`;
}

export type BlockPosition = { x: number; y: number; w: number };

/** Mesure les blocs `[data-block-id]` depuis le rendu colonnes → coordonnées en points PDF. */
export function measureBlockPositionsFromDOM(
  pageCount: number,
  fallback: Record<string, BlockPosition>
): Record<string, BlockPosition> {
  const nextPositions: Record<string, BlockPosition> = {};

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageEl = document.querySelector(`.cv-a4-page[data-page-index="${pageIndex}"]`);
    const contentEl = pageEl?.querySelector("[data-cv-page-content]") as HTMLElement | null;
    if (!pageEl || !contentEl) continue;

    const contentRect = contentEl.getBoundingClientRect();
    const scale = contentRect.width / A4_WIDTH_PX;
    if (!Number.isFinite(scale) || scale <= 0) continue;

    contentEl.querySelectorAll("[data-block-id]").forEach((el) => {
      const blockId = el.getAttribute("data-block-id");
      if (!blockId) return;

      const rect = el.getBoundingClientRect();
      const relativeX = (rect.left - contentRect.left) / scale;
      const relativeY = (rect.top - contentRect.top) / scale;

      let x = Math.round(relativeX / PT_TO_PX);
      let y = Math.round(relativeY / PT_TO_PX);
      let w = Math.max(40, Math.round(rect.width / scale / PT_TO_PX));

      // La photo est centrée dans un conteneur plus large : garder la taille réelle du cercle
      if (blockId === "photo" && fallback.photo) {
        w = fallback.photo.w;
      }

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w)) {
        const fb = fallback[blockId] ?? { x: 50, y: 100, w: 200 };
        x = fb.x;
        y = fb.y;
        w = fb.w;
      }

      nextPositions[blockId] = { x, y, w };
    });
  }

  if (!nextPositions.photo && fallback.photo) {
    nextPositions.photo = fallback.photo;
  }

  for (const key of Object.keys(fallback)) {
    if (!nextPositions[key]) {
      nextPositions[key] = fallback[key];
    }
  }

  return nextPositions;
}

interface CVPageScaleWrapperProps {
  children: React.ReactNode;
  zoom?: number;
  pageIndex?: number;
  onScaleChange?: (finalScale: number) => void;
  fitToContainer?: boolean;
  /** Si true, le contenu peut dépasser la hauteur A4 (mode colonnes éditeur). */
  allowContentOverflow?: boolean;
  /** Hauteur minimale forcée du contenu (px, avant scale) — ex. mode absolu. */
  minContentHeightPx?: number;
}

/** Scales an A4 page to fit its container; reports combined scale for drag math. */
export function CVPageScaleWrapper({
  children,
  zoom = 1,
  pageIndex = 0,
  onScaleChange,
  fitToContainer = true,
  allowContentOverflow = false,
  minContentHeightPx,
}: CVPageScaleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(1);
  const [contentHeightPx, setContentHeightPx] = useState(A4_HEIGHT_PX);
  const onScaleChangeRef = useRef(onScaleChange);
  onScaleChangeRef.current = onScaleChange;

  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el?.parentElement) return;

    const parent = el.parentElement;
    const parentWidth = Math.max(200, parent.clientWidth - 32);
    const parentHeight = Math.max(200, parent.clientHeight - 16);
    const scaleW = parentWidth / A4_WIDTH_PX;
    const allowVerticalGrowth =
      allowContentOverflow || (minContentHeightPx ?? 0) > A4_HEIGHT_PX;
    const scaleH =
      fitToContainer && !allowVerticalGrowth
        ? parentHeight / A4_HEIGHT_PX
        : Number.POSITIVE_INFINITY;
    const nextBase = Math.min(1, scaleW, scaleH);
    setBaseScale(nextBase);
    onScaleChangeRef.current?.(nextBase * zoom);
  }, [zoom, fitToContainer, allowContentOverflow, minContentHeightPx]);

  const measureContentHeight = useCallback(() => {
    const floor = Math.max(A4_HEIGHT_PX, minContentHeightPx ?? A4_HEIGHT_PX);
    const contentEl = contentRef.current;
    if (!contentEl || !allowContentOverflow) {
      setContentHeightPx(floor);
      return;
    }
    setContentHeightPx(Math.max(floor, contentEl.scrollHeight));
  }, [allowContentOverflow, minContentHeightPx]);

  useEffect(() => {
    updateScale();
    measureContentHeight();
    const el = containerRef.current;
    const parent = el?.parentElement;
    const ro = parent ? new ResizeObserver(updateScale) : null;
    if (parent && ro) ro.observe(parent);
    window.addEventListener("resize", updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [updateScale, measureContentHeight]);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || !allowContentOverflow) return;
    measureContentHeight();
    const ro = new ResizeObserver(measureContentHeight);
    ro.observe(contentEl);
    return () => ro.disconnect();
  }, [allowContentOverflow, measureContentHeight, minContentHeightPx, children]);

  const finalScale = baseScale * zoom;
  const pageHeightPx = allowContentOverflow
    ? contentHeightPx
    : Math.max(A4_HEIGHT_PX, minContentHeightPx ?? A4_HEIGHT_PX);

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-start py-2 shrink-0 w-full"
      style={{ height: `${pageHeightPx * finalScale + 24}px` }}
    >
      <div
        data-page-index={pageIndex}
        className={cn(
          "shadow-2xl border border-border/60 bg-white text-zinc-900 shrink-0 cv-a4-page relative mx-auto",
          allowContentOverflow ? "overflow-visible" : "overflow-hidden"
        )}
        style={{
          width: `${A4_WIDTH_PX * finalScale}px`,
          minHeight: `${A4_HEIGHT_PX * finalScale}px`,
          height: allowContentOverflow ? `${pageHeightPx * finalScale}px` : `${A4_HEIGHT_PX * finalScale}px`,
        }}
      >
        <div
          ref={contentRef}
          data-cv-page-content
          style={{
            transform: `scale(${finalScale})`,
            transformOrigin: "top left",
            width: `${A4_WIDTH_PX}px`,
            minHeight: `${A4_HEIGHT_PX}px`,
            height: allowContentOverflow ? "auto" : `${A4_HEIGHT_PX}px`,
            position: "absolute",
            left: 0,
            top: 0,
          }}
          className={cn(
            "w-full",
            allowContentOverflow ? "overflow-visible" : "overflow-hidden h-full"
          )}
        >
          {children}
        </div>
        {pageHeightPx > A4_HEIGHT_PX && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-amber-400/70 pointer-events-none z-50"
            style={{ top: `${A4_HEIGHT_PX * finalScale}px` }}
            title="Limite page A4"
          />
        )}
      </div>
    </div>
  );
}

interface EditableTextProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
}

export function EditableText({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
  style,
}: EditableTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (ref.current && !isFocused && ref.current.innerText !== value) {
      ref.current.innerText = value || "";
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    if (ref.current) {
      onChange(ref.current.innerText.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onFocus={() => setIsFocused(true)}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      className={cn(
        "outline-none transition-colors duration-100 cursor-text select-text inline-block min-w-[20px]",
        isFocused
          ? "bg-primary/5 ring-1 ring-primary/20 rounded px-0.5"
          : "hover:bg-primary/5 hover:ring-1 hover:ring-primary/10 rounded px-0.5",
        !value && "text-muted-foreground/40 italic empty:before:content-[attr(data-placeholder)]",
        className
      )}
      style={style}
    />
  );
}
