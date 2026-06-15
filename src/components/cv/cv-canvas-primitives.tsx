"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCanvasFormat } from "./canvas/use-canvas-format";

// Conversion EXACTE des points PDF (72 dpi) en pixels CSS (96 dpi) : 96/72.
// Le rendu PDF (react-pdf) place les blocs en points ; le canvas applique ce
// même facteur → un bloc à (x, y) pt tombe au même endroit dans les deux.
export const PT_TO_PX = 96 / 72;
// Dimensions NATIVES d'une page A4 PDF (595.28 × 841.89 pt) converties en
// pixels. La page du canvas a ainsi EXACTEMENT la taille d'une page PDF : ce
// que tu vois en édition correspond au rendu PDF final.
export const A4_WIDTH_PX = 595.28 * PT_TO_PX;  // ≈ 793.7
export const A4_HEIGHT_PX = 841.89 * PT_TO_PX; // ≈ 1122.5

/** Couleur de sélection du canvas (indigo) — indépendante du thème du CV,
 *  pour rester lisible quelle que soit la couleur d'accent choisie. */
export const SELECTION_COLOR = "#6366f1";

export function ptsToPx(pts: number): string {
  return `${pts * PT_TO_PX}px`;
}

export type BlockPosition = { x: number; y: number; w: number };

interface CVPageScaleWrapperProps {
  children: React.ReactNode;
  zoom?: number;
  pageIndex?: number;
  onScaleChange?: (finalScale: number) => void;
  fitToContainer?: boolean;
  /** Hauteur minimale forcée du contenu (px, avant scale). */
  minContentHeightPx?: number;
}

/** Scales an A4 page to fit its container; reports combined scale for drag math. */
export function CVPageScaleWrapper({
  children,
  zoom = 1,
  pageIndex = 0,
  onScaleChange,
  fitToContainer = true,
  minContentHeightPx,
}: CVPageScaleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [baseScale, setBaseScale] = useState(1);
  const onScaleChangeRef = useRef(onScaleChange);
  useEffect(() => {
    onScaleChangeRef.current = onScaleChange;
  }, [onScaleChange]);

  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el?.parentElement) return;

    const parent = el.parentElement;
    // Largeur disponible : le scroll container a un p-4 (16px de chaque côté).
    const parentWidth = Math.max(200, parent.clientWidth - 32);
    // On ajuste UNIQUEMENT sur la largeur, exactement comme le viewer PDF de
    // l'iframe : ce qui dépasse en hauteur défile en scroll vertical natif.
    // Ajuster aussi sur la hauteur rapetissait la page par rapport au PDF
    // (perception de « page plus petite »).
    const scaleW = parentWidth / A4_WIDTH_PX;
    const nextBase = fitToContainer ? Math.min(1, scaleW) : 1;
    setBaseScale(nextBase);
    onScaleChangeRef.current?.(nextBase * zoom);
  }, [zoom, fitToContainer]);

  useEffect(() => {
    updateScale();
    const parent = containerRef.current?.parentElement;
    const ro = parent ? new ResizeObserver(updateScale) : null;
    if (parent && ro) ro.observe(parent);
    window.addEventListener("resize", updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [updateScale]);

  const finalScale = baseScale * zoom;
  const pageHeightPx = Math.max(A4_HEIGHT_PX, minContentHeightPx ?? A4_HEIGHT_PX);

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-start py-2 shrink-0 w-full"
      style={{ height: `${pageHeightPx * finalScale + 24}px` }}
    >
      <div
        data-page-index={pageIndex}
        className="shadow-2xl border border-border/60 bg-white text-zinc-900 shrink-0 cv-a4-page relative mx-auto overflow-hidden"
        style={{
          width: `${A4_WIDTH_PX * finalScale}px`,
          height: `${pageHeightPx * finalScale}px`,
        }}
      >
        <div
          data-cv-page-content
          style={{
            transform: `scale(${finalScale})`,
            transformOrigin: "top left",
            width: `${A4_WIDTH_PX}px`,
            minHeight: `${pageHeightPx}px`,
            position: "absolute",
            left: 0,
            top: 0,
          }}
          className="w-full overflow-hidden"
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

/** Detects whether a stored value contains inline rich-text markup (B/I/U/S,
 *  color/size/font spans, alignment divs, or legacy <font>). Plain strings
 *  render via textContent (XSS-safe); HTML strings use innerHTML so format
 *  tags survive across re-renders and reach the PDF renderer intact. */
function isRichTextValue(v: string): boolean {
  return /<(b|i|u|s|strong|em|span|div|p|font)[\s>/]/i.test(v);
}

/** Trim leading/trailing whitespace text without disturbing inline tags. */
function trimRich(v: string): string {
  return v.replace(/^(?:&nbsp;|\s|<br\s*\/?>)+/i, "").replace(/(?:&nbsp;|\s|<br\s*\/?>)+$/i, "").trim();
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
  const format = useCanvasFormat();

  // Sync incoming value → DOM. We use innerHTML when the stored value is
  // rich-text (contains inline format tags), and textContent otherwise so
  // plain strings can never be interpreted as markup (XSS-safe by default).
  useEffect(() => {
    if (!ref.current || isFocused) return;
    const current = ref.current.innerHTML;
    const next = value || "";
    if (isRichTextValue(next)) {
      if (current !== next) ref.current.innerHTML = next;
    } else {
      // Use textContent for safety; only set if it differs from the rendered
      // text (compare via innerText so existing inline tags don't trigger a
      // pointless overwrite that would clobber the user's caret).
      if (ref.current.innerText !== next) {
        ref.current.textContent = next;
      }
    }
  }, [value, isFocused]);

  const commit = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    // If the rendered content has no inline formatting tags, save the plain
    // text. Keeps the data file readable when the user never used B/I/U.
    const next = isRichTextValue(html) ? trimRich(html) : (ref.current.innerText ?? "").trim();
    if (next !== value) onChange(next);
  }, [onChange, value]);

  const handleBlur = () => {
    setIsFocused(false);
    format.registerActiveEditor(null);
    commit();
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
      spellCheck={false}
      onBlur={handleBlur}
      onFocus={() => {
        setIsFocused(true);
        format.registerActiveEditor(ref.current);
      }}
      onInput={() => {
        // Re-evaluate the toolbar's format state on every typed character so
        // active B/I/U highlights stay in sync as the caret moves.
        format.refresh();
      }}
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
