"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Search, Pipette, Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/** Default solid colors — laid out as a 7-column grid like Canva's palette. */
const DEFAULT_SOLIDS: string[] = [
  // row 1: greyscale
  "#000000", "#525252", "#737373", "#a3a3a3", "#d4d4d4", "#e5e5e5", "#ffffff",
  // row 2: warm reds → pinks → purples
  "#ef4444", "#f97316", "#ec4899", "#d8b4fe", "#a855f7", "#7c3aed", "#4f46e5",
  // row 3: blues/teals
  "#0ea5e9", "#06b6d4", "#22d3ee", "#3b82f6", "#1d4ed8", "#1e3a8a", "#0c4a6e",
  // row 4: greens → yellows → oranges
  "#10b981", "#22c55e", "#84cc16", "#fde047", "#fbbf24", "#fb923c", "#dc2626",
];

/** Palette étendue (affichée via « Afficher tout ») : nuances supplémentaires
 *  + teintes claires/foncées pour un choix proche de Canva. */
const DEFAULT_SOLIDS_ALL: string[] = [
  ...DEFAULT_SOLIDS,
  // teintes profondes
  "#7f1d1d", "#9a3412", "#854d0e", "#3f6212", "#065f46", "#155e75", "#1e1b4b",
  // teintes moyennes
  "#b91c1c", "#c2410c", "#a16207", "#4d7c0f", "#047857", "#0e7490", "#4338ca",
  // pastels
  "#fecaca", "#fed7aa", "#fef08a", "#bbf7d0", "#a7f3d0", "#a5f3fc", "#c7d2fe",
  // pastels 2
  "#fbcfe8", "#e9d5ff", "#ddd6fe", "#bfdbfe", "#99f6e4", "#d9f99d", "#fde68a",
  // bruns / neutres chauds
  "#78350f", "#92400e", "#451a03", "#1c1917", "#44403c", "#78716c", "#a8a29e",
];

const TEXT_PRESETS: string[] = ["#ffffff", "#000000", "#059669", "#1d4ed8", "#7f1d1d"];

const COLOR_NAME_MAP: Record<string, string[]> = {
  "#000000": ["noir", "black"],
  "#ffffff": ["blanc", "white"],
  "#ef4444": ["rouge", "red"],
  "#fb923c": ["orange"],
  "#fbbf24": ["jaune", "yellow", "ambre"],
  "#22c55e": ["vert", "green"],
  "#06b6d4": ["cyan", "turquoise"],
  "#0ea5e9": ["bleu ciel", "sky"],
  "#3b82f6": ["bleu", "blue"],
  "#7c3aed": ["violet", "purple"],
  "#ec4899": ["rose", "pink"],
};

function matchesQuery(color: string, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (color.toLowerCase().includes(q)) return true;
  const names = COLOR_NAME_MAP[color.toLowerCase()] ?? [];
  return names.some((n) => n.includes(q));
}

interface ColorDrawerProps {
  open: boolean;
  /** Currently selected color (highlighted with a ring). */
  value?: string | null;
  /** Recently used colors — surfaces what the user just picked. */
  recent?: string[];
  /** Brand colors managed in the theme — empty list shows an "Add" CTA. */
  brand?: string[];
  onPick: (color: string) => void;
  onClose: () => void;
  /** Épingle une couleur dans l'identité visuelle (brand kit). */
  onAddBrand?: (color: string) => void;
  /** Retire une couleur de l'identité visuelle. */
  onRemoveBrand?: (color: string) => void;
}

/** Left-side floating drawer matching screenshot 2: search + sections (text
 *  colors, brand kit, default solids). Opens over the canvas without pushing
 *  it, dismissed via close button, Escape, or click outside. */
export function ColorDrawer({ open, value, recent, brand = [], onPick, onClose, onAddBrand, onRemoveBrand }: ColorDrawerProps) {
  const t = useTranslations("Canvas");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  /** Couleur courante normalisée — utilisée pour épingler dans le brand kit. */
  const currentColor = value && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : "#000000";
  const isInBrand = brand.some((c) => c.toLowerCase() === currentColor);

  // Dismiss on Escape / outside click. We attach on next tick to skip the
  // click event that just opened the drawer.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onDown);
    }, 0);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const recentList = (recent ?? []).filter((c) => matchesQuery(c, query));
  const textPresets = TEXT_PRESETS.filter((c) => matchesQuery(c, query));
  // « Afficher tout » (ou une recherche active) déplie la palette étendue.
  const solidsSource = showAll || query.trim() ? DEFAULT_SOLIDS_ALL : DEFAULT_SOLIDS;
  const solids = solidsSource.filter((c) => matchesQuery(c, query));

  return (
    <div
      ref={panelRef}
      data-canvas-toolbar
      className="absolute left-3 top-[60px] z-40 w-[340px] max-h-[calc(100%-72px)] flex flex-col rounded-2xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/20 ring-1 ring-black/5 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
        <span className="text-sm font-semibold text-foreground">{t("color_panel_title")}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            onMouseDown={(e) => e.preventDefault()}
            className={cn(
              "size-7 flex items-center justify-center rounded-md hover:bg-muted/60",
              showAll ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground",
            )}
            title={t("color_section_default_show_all")}
          >
            <MoreHorizontal size={14} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60"
            title={t("format_text_color_open")}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 pb-3 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("color_search_placeholder")}
            className="w-full h-9 pl-8 pr-3 rounded-full border border-border bg-muted/40 hover:bg-muted/60 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all text-xs"
          />
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4 scrollbar-thin">
        {/* Text colors row: pipette + custom picker + recent presets */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Pipette size={13} className="text-muted-foreground" />
            <span className="text-[11px] font-semibold text-foreground">{t("color_section_text")}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <CustomColorButton onPick={onPick} value={value ?? null} />
            <EyedropperButton onPick={onPick} />
            {[...new Set([...(recentList ?? []), ...textPresets])].slice(0, 5).map((c) => (
              <Swatch key={c} color={c} active={(value ?? "").toLowerCase() === c.toLowerCase()} onClick={() => onPick(c)} />
            ))}
          </div>
        </section>

        {/* Brand kit */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold text-foreground">{t("color_section_brand")}</span>
            {onAddBrand && !isInBrand && (
              <button
                type="button"
                onClick={() => onAddBrand(currentColor)}
                onMouseDown={(e) => e.preventDefault()}
                className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                title={t("color_brand_pin")}
              >
                <Plus size={11} />
                {t("color_brand_pin")}
              </button>
            )}
          </div>
          {brand.length === 0 ? (
            <button
              type="button"
              onClick={() => onAddBrand?.(currentColor)}
              onMouseDown={(e) => e.preventDefault()}
              className="w-full h-9 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-border/80 text-[11px] font-medium transition-colors"
            >
              <Plus size={13} />
              {t("color_section_brand_add")}
            </button>
          ) : (
            <div className="grid grid-cols-7 gap-1.5">
              {brand.map((c) => (
                <BrandSwatch
                  key={c}
                  color={c}
                  active={(value ?? "").toLowerCase() === c.toLowerCase()}
                  onClick={() => onPick(c)}
                  onRemove={onRemoveBrand ? () => onRemoveBrand(c) : undefined}
                  removeTitle={t("color_brand_remove")}
                />
              ))}
            </div>
          )}
        </section>

        {/* Default solid colors */}
        <section>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold text-foreground">{t("color_section_default")}</span>
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
              className="text-[11px] text-primary hover:underline"
            >
              {showAll ? t("color_section_default_show_less") : t("color_section_default_show_all")}
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {solids.map((c) => (
              <Swatch key={c} color={c} active={(value ?? "").toLowerCase() === c.toLowerCase()} onClick={() => onPick(c)} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Swatch({ color, active, onClick }: { color: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Don't steal focus from the contentEditable text — without this, the
      // user's selection collapses the moment they reach for a color.
      onMouseDown={(e) => e.preventDefault()}
      title={color}
      className={cn(
        "size-7 rounded-full border transition-transform hover:scale-110 shrink-0",
        active
          ? "border-foreground ring-2 ring-offset-2 ring-offset-popover ring-primary"
          : color.toLowerCase() === "#ffffff"
            ? "border-border"
            : "border-black/10",
      )}
      style={{ backgroundColor: color }}
    />
  );
}

/** Swatch du brand kit : une couleur épinglée, supprimable via un petit × au
 *  survol (sans voler le focus du texte en édition). */
function BrandSwatch({
  color,
  active,
  onClick,
  onRemove,
  removeTitle,
}: {
  color: string;
  active?: boolean;
  onClick: () => void;
  onRemove?: () => void;
  removeTitle?: string;
}) {
  return (
    <div className="relative group/brand">
      <Swatch color={color} active={active} onClick={onClick} />
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onMouseDown={(e) => e.preventDefault()}
          title={removeTitle}
          className="absolute -top-1 -right-1 size-3.5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover/brand:opacity-100 transition-opacity shadow-sm"
        >
          <X size={9} strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

/** "Rainbow + plus" entry: opens the native color picker to allow any custom
 *  color. We hide the actual input and trigger it via a styled button so the
 *  swatch matches Canva's visual treatment. */
function CustomColorButton({ value, onPick }: { value: string | null; onPick: (c: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => ref.current?.click()}
        onMouseDown={(e) => e.preventDefault()}
        className="size-7 rounded-full shrink-0 border border-border/60 flex items-center justify-center shadow-sm relative overflow-hidden"
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, #ef4444, #f97316, #fbbf24, #22c55e, #06b6d4, #3b82f6, #a855f7, #ec4899, #ef4444)",
        }}
        title="Custom color"
      >
        <span className="absolute inset-1 rounded-full bg-card flex items-center justify-center">
          <Plus size={11} className="text-foreground" />
        </span>
      </button>
      <input
        ref={ref}
        type="color"
        defaultValue={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
        onChange={(e) => onPick(e.target.value)}
        className="sr-only"
        tabIndex={-1}
      />
    </div>
  );
}

/** Eyedropper button. Falls back to a no-op if the browser doesn't support
 *  the EyeDropper API (Safari, older Firefox). */
function EyedropperButton({ onPick }: { onPick: (c: string) => void }) {
  type EyeDropperWindow = { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } };
  const supported = typeof window !== "undefined" && "EyeDropper" in window;
  const handleClick = async () => {
    if (!supported) return;
    try {
      const w = window as unknown as EyeDropperWindow;
      const Ctor = w.EyeDropper;
      if (!Ctor) return;
      const result = await new Ctor().open();
      if (result?.sRGBHex) onPick(result.sRGBHex);
    } catch {
      // User cancelled — nothing to do.
    }
  };
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.preventDefault()}
      className="size-7 rounded-full shrink-0 border border-border/60 bg-card hover:bg-muted/60 flex items-center justify-center shadow-sm"
      title="Eyedropper"
    >
      <Pipette size={12} className="text-foreground" />
    </button>
  );
}
