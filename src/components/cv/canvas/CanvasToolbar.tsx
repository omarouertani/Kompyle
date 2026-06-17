"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Minus,
  Plus,
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
import { FONT_FAMILIES, ThemePanel } from "./ThemePanel";
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
  onZoomChange: (zoom: number) => void;
  onZoomFit: () => void;
  onRealign: () => void;
  onCanvasBgChange: (bg: CanvasBackground) => void;
  /** Re-stacks blocks (preserving manual positions) after a change that alters
   *  a block's height — e.g. a selection font-size/font-family change — so the
   *  canvas stays overlap-free and matches the PDF, which uses these positions. */
  onReflow?: () => void;
  /** Blocs actuellement sélectionnés sur le canvas (sélection au niveau bloc). */
  selectedIds?: string[];
  /** Applique une commande d'édition (bold/italic/underline/strikeThrough/foreColor)
   *  à TOUT le texte des blocs sélectionnés — vrai comportement bascule. Renvoie
   *  true si appliqué. Utilisé quand aucun texte n'est sélectionné DANS un éditeur. */
  onBlockCommand?: (command: string, value?: string, opts?: { toggle?: boolean }) => boolean;
  /** Enveloppe le texte des blocs sélectionnés dans un style (police/taille/titre). */
  onBlockStyles?: (styles: Record<string, string>) => boolean;
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
  onZoomChange,
  onZoomFit,
  onRealign,
  onCanvasBgChange,
  onReflow,
  onThemeChange,
  selectedIds = [],
  onBlockCommand,
  onBlockStyles,
}: CanvasToolbarProps) {
  const t = useTranslations("Canvas");
  const fmt = useCanvasFormat();
  const [showColorDrawer, setShowColorDrawer] = useState(false);
  // Couleurs récentes / de marque persistées dans le thème (survivent au
  // rechargement et au changement de navigateur, via cv_data JSONB).
  const recentColors = theme.recentColors ?? [];
  const brandColors = theme.brandColors ?? [];

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

  const normalizeHex = (c: string) => c.trim().toLowerCase();

  // Cœur du formatage : si l'utilisateur a une VRAIE sélection de texte dans un
  // éditeur (mots surlignés), on applique au niveau caractère (`editorRun`).
  // Sinon, dès qu'au moins un bloc est sélectionné sur le canvas, on applique au
  // TOUT le texte du/des bloc(s) via les commandes natives (`blockRun`) —
  // « sélectionner un bloc » suffit donc, AVEC bascule réelle (gras on/off).
  const applyFmt = (editorRun: () => boolean, blockRun: () => boolean, reflow = false) => {
    if (fmt.state.hasSelection && editorRun()) {
      if (reflow) onReflow?.();
      return true;
    }
    if (selectedIds.length >= 1 && blockRun()) {
      onReflow?.();
      return true;
    }
    // Repli : caret actif dans un éditeur (sans sélection) → l'éditeur étend au
    // bloc entier ; sinon no-op.
    const ok = editorRun();
    if (ok && reflow) onReflow?.();
    return ok;
  };

  const handlePickColor = (color: string) => {
    const c = normalizeHex(color);
    if (applyFmt(() => fmt.exec("foreColor", color), () => onBlockCommand?.("foreColor", color) ?? false)) {
      onThemeChange({
        recentColors: [c, ...recentColors.filter((x) => x.toLowerCase() !== c)].slice(0, 8),
      });
    }
  };

  const handleAddBrand = (color: string) => {
    const c = normalizeHex(color);
    if (brandColors.some((x) => x.toLowerCase() === c)) return;
    onThemeChange({ brandColors: [...brandColors, c] });
  };

  const handleRemoveBrand = (color: string) => {
    const c = normalizeHex(color);
    onThemeChange({ brandColors: brandColors.filter((x) => x.toLowerCase() !== c) });
  };

  const currentColor = fmt.state.textColor || theme.textColor || "#27272a";

  // H1/H2 = style inline sur la sélection (taille + gras + couleur accent).
  // Se synchronise au PDF via le pipeline inline-html existant.
  const headingBase = theme.headingSize ?? 12;
  const accentColor = theme.primaryColor || "#1a1a1a";
  const applyHeading = (scale: number) => {
    const size = Math.round(headingBase * scale * 10) / 10;
    const styles = { "font-size": `${size}pt`, "font-weight": "bold", color: accentColor };
    applyFmt(() => fmt.applyInlineStyles(styles), () => onBlockStyles?.(styles) ?? false, true);
  };

  return (
    <>
      <div
        data-canvas-toolbar
        className="border-b border-border/45 bg-background/95 backdrop-blur-md z-20 shrink-0 w-full shadow-sm"
      >
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap">
          {/* Thème & dimensions (palettes, couleurs, sidebar, compétences,
              tailles). Compact : police/taille restent inline ci-dessous. */}
          <ThemePanel theme={theme} onThemeChange={onThemeChange} compact />

          {/* ── Format group : font · size · A · B I U S · align · lists · H1 H2 ── */}
          <ToolGroup>
            <FontFamilyPicker
              value={activeFont}
              onChange={(f) => {
                // Sélection de texte → applique au texte ; sinon, au(x) bloc(s)
                // sélectionné(s). Reflow car la hauteur peut changer.
                const stack = FONT_FAMILIES[f].stack;
                applyFmt(() => fmt.applyInlineStyle("font-family", stack), () => onBlockStyles?.({ "font-family": stack }) ?? false, true);
              }}
            />
            <FontSizeStepper
              size={pendingSize}
              onChange={(v) => {
                setPendingSize(v);
                // Un changement de taille modifie la hauteur du bloc → re-stack.
                applyFmt(() => fmt.applyInlineStyle("font-size", `${v}pt`), () => onBlockStyles?.({ "font-size": `${v}pt` }) ?? false, true);
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
              onClick={() => applyFmt(() => fmt.exec("bold"), () => onBlockCommand?.("bold", undefined, { toggle: true }) ?? false)}
            >
              <Bold size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton
              title={t("format_italic")}
              active={fmt.state.italic}
              onClick={() => applyFmt(() => fmt.exec("italic"), () => onBlockCommand?.("italic", undefined, { toggle: true }) ?? false)}
            >
              <Italic size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton
              title={t("format_underline")}
              active={fmt.state.underline}
              onClick={() => applyFmt(() => fmt.exec("underline"), () => onBlockCommand?.("underline", undefined, { toggle: true }) ?? false)}
            >
              <Underline size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton
              title={t("format_strike")}
              active={fmt.state.strike}
              onClick={() => applyFmt(() => fmt.exec("strikeThrough"), () => onBlockCommand?.("strikeThrough", undefined, { toggle: true }) ?? false)}
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
            <ToolButton
              title={t("format_list_bullet")}
              onClick={() => { if (fmt.exec("insertUnorderedList")) onReflow?.(); }}
            >
              <List size={13} />
            </ToolButton>
          </ToolGroup>

          <ToolGroup>
            <ToolButton title={t("format_heading_1")} onClick={() => applyHeading(1.6)}>
              <Heading1 size={13} strokeWidth={2.5} />
            </ToolButton>
            <ToolButton title={t("format_heading_2")} onClick={() => applyHeading(1.3)}>
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
            {/* La suppression de page se fait via le menu contextuel (clic droit
                sur la page) — plus de bouton corbeille ici. */}
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
        brand={brandColors}
        onPick={handlePickColor}
        onAddBrand={handleAddBrand}
        onRemoveBrand={handleRemoveBrand}
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
