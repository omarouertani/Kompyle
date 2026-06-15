"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Minus,
  Plus,
  Trash2,
  Info,
  FilePlus,
  RotateCcw,
  Grid3x3,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  Heading1,
  Heading2,
  ChevronDown,
} from "lucide-react";
import type { CVTheme, CVFontFamily } from "@/types/cv";
import { FONT_FAMILIES } from "./ThemePanel";
import { ColorDrawer } from "./ColorDrawer";
import { useCanvasFormat } from "./use-canvas-format";

export type CanvasBackground = "neutral" | "dots" | "grid";

interface CanvasToolbarProps {
  pageCount: number;
  activePageIndex: number;
  zoom: number;
  theme: CVTheme;
  canvasBg: CanvasBackground;
  onThemeChange: (updates: Partial<CVTheme>, opts?: { reflow?: boolean }) => void;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onZoomChange: (zoom: number) => void;
  onZoomFit: () => void;
  onRealign: () => void;
  onCanvasBgChange: (bg: CanvasBackground) => void;
  /** Re-stacks blocks (preserving manual positions) after a change that alters
   *  a block's height — e.g. a selection font-size/font-family change — so the
   *  canvas stays overlap-free and matches the PDF, which uses these positions. */
  onReflow?: () => void;
}

export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2.5;

/** Canva-style canvas toolbar. Single row with logical groups:
 *  [Theme] | [Font] [Size] [A color] [B I U S] [Align] [Lists] [H1 H2] |
 *  [Pages] [Bg] [Realign] | [Zoom] | [info tooltip]
 *
 *  Font/size/text-color are inline (used to live inside the Theme popover).
 *  The Theme popover now holds only palette presets, skill-mode and dimension
 *  sliders — everything frequent enough to be one click away is exposed here. */
export function CanvasToolbar({
  pageCount,
  activePageIndex,
  zoom,
  theme,
  canvasBg,
  onSelectPage,
  onAddPage,
  onRemovePage,
  onZoomChange,
  onZoomFit,
  onRealign,
  onCanvasBgChange,
  onReflow,
  // onThemeChange intentionally not destructured: now that font, size, and
  // color all act on the selection (not the global theme), the toolbar no
  // longer writes the theme. We keep the prop in the interface so callers
  // don't break, but consume it via _.
}: CanvasToolbarProps) {
  const t = useTranslations("Canvas");
  const fmt = useCanvasFormat();
  const [showColorDrawer, setShowColorDrawer] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const BG_LABELS: Record<CanvasBackground, string> = {
    neutral: t("bg_neutral"),
    dots: t("bg_dots"),
    grid: t("bg_grid"),
  };
  const cycleBg = () => {
    const order: CanvasBackground[] = ["neutral", "dots", "grid"];
    onCanvasBgChange(order[(order.indexOf(canvasBg) + 1) % order.length]);
  };

  const activeFont: CVFontFamily = theme.fontFamily ?? "sans";
  const baseFontSize = theme.fontSize ?? 10;
  // Local UI state for the size stepper so each click bumps the displayed
  // number AND wraps the selection — but doesn't push to the global theme.
  // Sync to the theme default via the compare-during-render pattern (avoids
  // a useEffect + setState cascade that the lint rule flags).
  const [pendingSize, setPendingSize] = useState<number>(baseFontSize);
  const [lastSeenBase, setLastSeenBase] = useState<number>(baseFontSize);
  if (lastSeenBase !== baseFontSize) {
    setLastSeenBase(baseFontSize);
    setPendingSize(baseFontSize);
  }

  const handlePickColor = (color: string) => {
    if (fmt.exec("foreColor", color)) {
      setRecentColors((prev) => [color, ...prev.filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(0, 5));
    }
  };

  const currentColor = fmt.state.textColor || theme.textColor || "#27272a";

  return (
    <>
      <div
        data-canvas-toolbar
        className="border-b border-border/45 bg-background/95 backdrop-blur-md z-20 shrink-0 w-full shadow-sm"
      >
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
          {/* ── Format group : font · size · A · B I U S · align · lists · H1 H2 ── */}
          <ToolGroup>
            <FontFamilyPicker
              value={activeFont}
              onChange={(f) => {
                // Wrap the selection in <span style="font-family: …"> so the
                // change applies ONLY to selected text, not the whole CV.
                if (fmt.applyInlineStyle("font-family", FONT_FAMILIES[f].stack)) onReflow?.();
              }}
            />
            <FontSizeStepper
              size={pendingSize}
              onChange={(v) => {
                setPendingSize(v);
                // A size change alters the block's height → re-stack blocks so
                // nothing overlaps and the canvas matches the PDF output.
                if (fmt.applyInlineStyle("font-size", `${v}pt`)) onReflow?.();
              }}
            />
          </ToolGroup>

          <ToolGroup>
            <ToolButton
              title={t("format_text_color_open")}
              active={showColorDrawer}
              onClick={() => setShowColorDrawer((v) => !v)}
              className="px-1.5"
            >
              <span className="flex flex-col items-center leading-none">
                <span className="text-[11px] font-bold text-foreground">A</span>
                <span
                  className="block h-[3px] w-3.5 rounded-sm"
                  style={{ backgroundColor: currentColor }}
                />
              </span>
            </ToolButton>
          </ToolGroup>

          <ToolGroup>
            <ToolButton
              title={t("format_bold")}
              active={fmt.state.bold}
              onClick={() => fmt.exec("bold")}
            >
              <Bold size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton
              title={t("format_italic")}
              active={fmt.state.italic}
              onClick={() => fmt.exec("italic")}
            >
              <Italic size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton
              title={t("format_underline")}
              active={fmt.state.underline}
              onClick={() => fmt.exec("underline")}
            >
              <Underline size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton
              title={t("format_strike")}
              active={fmt.state.strike}
              onClick={() => fmt.exec("strikeThrough")}
            >
              <Strikethrough size={13} strokeWidth={2.5} />
            </ToolButton>
          </ToolGroup>

          <ToolGroup>
            <ToolButton
              title={t("format_align_left")}
              active={fmt.state.align === "left"}
              onClick={() => fmt.exec("justifyLeft")}
            >
              <AlignLeft size={13} />
            </ToolButton>
            <ToolButton
              title={t("format_align_center")}
              active={fmt.state.align === "center"}
              onClick={() => fmt.exec("justifyCenter")}
            >
              <AlignCenter size={13} />
            </ToolButton>
            <ToolButton
              title={t("format_align_right")}
              active={fmt.state.align === "right"}
              onClick={() => fmt.exec("justifyRight")}
            >
              <AlignRight size={13} />
            </ToolButton>
            <ToolButton
              title={t("format_align_justify")}
              active={fmt.state.align === "justify"}
              onClick={() => fmt.exec("justifyFull")}
            >
              <AlignJustify size={13} />
            </ToolButton>
            <ToolButton title={t("format_list_bullet")}>
              <List size={13} />
            </ToolButton>
          </ToolGroup>

          <ToolGroup>
            <ToolButton title={t("format_heading_1")}>
              <Heading1 size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton title={t("format_heading_2")}>
              <Heading2 size={13} strokeWidth={2.5} />
            </ToolButton>
          </ToolGroup>

          {/* Push the layout/zoom controls to the right edge */}
          <div className="flex-1" />

          {/* Page controls */}
          <ToolGroup>
            {Array.from({ length: pageCount }, (_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectPage(idx)}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "px-2 h-7 text-[10px] font-semibold rounded-md transition-all",
                  activePageIndex === idx
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                P{idx + 1}
              </button>
            ))}
            <ToolButton onClick={onAddPage} title={t("add_page")}>
              <FilePlus size={12} />
            </ToolButton>
            {pageCount > 1 && (
              <ToolButton onClick={onRemovePage} title={t("remove_page")} destructive>
                <Trash2 size={12} />
              </ToolButton>
            )}
          </ToolGroup>

          {/* Canvas tools : bg + realign */}
          <ToolGroup>
            <ToolButton
              onClick={cycleBg}
              title={BG_LABELS[canvasBg]}
              active={canvasBg !== "neutral"}
            >
              <Grid3x3 size={12} />
            </ToolButton>
            <ToolButton onClick={onRealign} title={t("realign_tooltip")}>
              <RotateCcw size={12} />
            </ToolButton>
          </ToolGroup>

          {/* Zoom — isolated on the far right, controls the global view */}
          <ToolGroup>
            <ToolButton onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - 0.1))} title="−">
              <Minus size={12} />
            </ToolButton>
            <span className="text-[10px] font-mono font-medium min-w-[34px] text-center text-foreground px-0.5">
              {Math.round(zoom * 100)}%
            </span>
            <ToolButton onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + 0.1))} title="+">
              <Plus size={12} />
            </ToolButton>
            <button
              type="button"
              onClick={onZoomFit}
              onMouseDown={(e) => e.preventDefault()}
              className="px-2 h-7 text-[10px] font-semibold rounded-md transition-all bg-background hover:bg-muted/80 text-foreground"
              title={t("zoom_fit_tooltip")}
            >
              {t("zoom_fit")}
            </button>
          </ToolGroup>

          {/* Info / shortcuts — single icon, tooltip on hover instead of the
              long help-text strip that used to swallow horizontal space. */}
          <Divider />
          <ShortcutsHelpButton />
        </div>
      </div>

      <ColorDrawer
        open={showColorDrawer}
        value={currentColor}
        recent={recentColors}
        onPick={handlePickColor}
        onClose={() => setShowColorDrawer(false)}
      />
    </>
  );
}

/* ── Toolbar primitives ─────────────────────────────────────────────────── */

function Divider() {
  return <div className="w-px h-5 bg-border/60 mx-0.5 shrink-0" />;
}

function ToolGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-lg border border-border/60 shadow-sm h-8 shrink-0">
      {children}
    </div>
  );
}

interface ToolButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  destructive?: boolean;
  title?: string;
  className?: string;
}

function ToolButton({ children, onClick, active, destructive, title, className }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      // CRITICAL: mousedown must not steal focus from the contentEditable
      // EditableText — otherwise the browser focuses this button and the
      // user's selection collapses, leaving execCommand nothing to act on.
      onMouseDown={(e) => e.preventDefault()}
      title={title}
      className={cn(
        "h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded-md transition-colors text-[10px] font-medium",
        active
          ? "bg-card text-primary shadow-sm ring-1 ring-primary/20"
          : destructive
            ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function FontFamilyPicker({ value, onChange }: { value: CVFontFamily; onChange: (f: CVFontFamily) => void }) {
  const t = useTranslations("Canvas");
  const [open, setOpen] = useState(false);
  const stack = FONT_FAMILIES[value].stack;
  const label = FONT_FAMILIES[value].label;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseDown={(e) => e.preventDefault()}
        title={t("format_font")}
        className="h-7 px-2 flex items-center gap-1.5 rounded-md hover:bg-background/80 text-foreground text-[11px] min-w-[88px]"
        style={{ fontFamily: stack }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={11} className="text-muted-foreground shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-40 w-44 rounded-xl border border-border/70 bg-popover shadow-xl p-1">
            {(Object.entries(FONT_FAMILIES) as Array<[CVFontFamily, { label: string; stack: string }]>).map(([key, font]) => (
              <button
                key={key}
                type="button"
                onClick={() => { onChange(key); setOpen(false); }}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  "w-full px-2 py-1.5 rounded-md text-left text-xs transition-colors flex items-center justify-between",
                  value === key ? "bg-primary/10 text-foreground font-semibold" : "text-foreground hover:bg-muted/60",
                )}
                style={{ fontFamily: font.stack }}
              >
                <span>{font.label}</span>
                <span className="text-muted-foreground text-[10px]">Aa</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function FontSizeStepper({
  size,
  onChange,
}: {
  size: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations("Canvas");
  const clamp = (v: number) => Math.max(8, Math.min(72, v));
  // Buffer the typed value as a string so the user can clear the field and
  // type "12" without the parent re-rendering "1" then "12". We sync to the
  // incoming `size` prop using the compare-during-render pattern (no effect).
  const [draft, setDraft] = useState(String(size));
  const [lastSeenSize, setLastSeenSize] = useState(size);
  if (lastSeenSize !== size) {
    setLastSeenSize(size);
    setDraft(String(size));
  }
  const commitDraft = () => {
    const v = Number(draft);
    if (!Number.isNaN(v)) onChange(clamp(v));
    else setDraft(String(size));
  };
  return (
    <div className="flex items-center" title={t("format_size")}>
      <ToolButton onClick={() => onChange(clamp(Math.floor(size) - 1))} title="−">
        <Minus size={12} />
      </ToolButton>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="h-6 w-9 text-center bg-background border border-border/60 rounded text-[11px] font-mono font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
      />
      <ToolButton onClick={() => onChange(clamp(Math.floor(size) + 1))} title="+">
        <Plus size={12} />
      </ToolButton>
    </div>
  );
}

function ShortcutsHelpButton() {
  const t = useTranslations("Canvas");
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <ToolButton onClick={() => setOpen((o) => !o)} title={t("shortcuts_help")}>
        <Info size={13} />
      </ToolButton>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-40 w-72 rounded-xl border border-border/70 bg-popover shadow-xl p-3 text-[11px] text-foreground/90 leading-relaxed">
            <div className="font-semibold text-xs text-foreground mb-1.5">{t("shortcuts_title")}</div>
            <div className="text-muted-foreground">{t("hint")}</div>
          </div>
        </>
      )}
    </div>
  );
}
