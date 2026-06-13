"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CVTheme, CVFontFamily, SkillMode } from "@/types/cv";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Or Chaima", primary: "#fbbf24", sidebarBg: "#f4f4f5", textColor: "#27272a" },
  { name: "Bleu Corporate", primary: "#2563eb", sidebarBg: "#f8fafc", textColor: "#1e293b" },
  { name: "Vert Émeraude", primary: "#059669", sidebarBg: "#f0fdf4", textColor: "#0f5132" },
  { name: "Rouge Rubis", primary: "#dc2626", sidebarBg: "#fef2f2", textColor: "#7f1d1d" },
  { name: "Sombre Minimal", primary: "#18181b", sidebarBg: "#fafafa", textColor: "#27272a" },
];

/** Teintes rapides proposées sous chaque champ couleur. */
const QUICK_SWATCHES: Record<string, string[]> = {
  accent: ["#fbbf24", "#2563eb", "#059669", "#dc2626", "#7c3aed"],
  sidebar: ["#f4f4f5", "#f8fafc", "#f0fdf4", "#fef2f2", "#fafafa"],
  text: ["#27272a", "#1e293b", "#0f5132", "#7f1d1d", "#374151"],
  page: ["#ffffff", "#fdfcf7", "#f7f7f8", "#fbf8f1", "#f5f8fb"],
};

/** Polices disponibles sur le canvas (la clé est persistée dans theme.fontFamily). */
export const FONT_FAMILIES: Record<CVFontFamily, { label: string; stack: string }> = {
  sans: { label: "Sans", stack: "'Carlito', sans-serif" },
  serif: { label: "Serif", stack: "Georgia, 'Times New Roman', serif" },
  modern: { label: "Modern", stack: "'IBM Plex Sans Variable', system-ui, sans-serif" },
  mono: { label: "Mono", stack: "'Courier New', monospace" },
};

const SKILL_MODES: Array<{ value: SkillMode; label: string }> = [
  { value: "text", label: "Texte" },
  { value: "tags", label: "Tags" },
  { value: "bars", label: "Barres" },
];

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

function ColorField({
  label,
  value,
  swatches,
  onChange,
}: {
  label: string;
  value: string;
  swatches: string[];
  onChange: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Resynchronise le champ texte quand la valeur change ailleurs (preset,
  // swatch) — ajustement au rendu, pattern recommandé par la doc React.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const commitHex = (raw: string) => {
    const m = raw.trim().match(HEX_RE);
    if (m) onChange(`#${m[1].toLowerCase()}`);
    else setDraft(value);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</span>
      <div className="flex items-center gap-1.5">
        {/* Swatch cliquable → ouvre le sélecteur natif */}
        <button
          type="button"
          className="size-6 rounded-md border border-border shrink-0 cursor-pointer shadow-sm"
          style={{ backgroundColor: value }}
          title="Choisir une couleur"
          onClick={() => pickerRef.current?.click()}
        />
        <input
          ref={pickerRef}
          type="color"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
        {/* Hex inline */}
        <input
          type="text"
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commitHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitHex((e.target as HTMLInputElement).value);
          }}
          className="w-full min-w-0 text-[10px] font-mono px-1 py-0.5 rounded border border-border bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>
      {/* Teintes rapides */}
      <div className="flex gap-1">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "size-3.5 rounded-full border transition-transform hover:scale-110",
              value.toLowerCase() === c.toLowerCase() ? "border-foreground" : "border-border/60"
            )}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  /** Appelé au relâchement du slider (déclenche le réalignement). */
  onCommit?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase">
        <span>{label}</span>
        <span className="font-mono text-xs text-foreground">
          {value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        className="w-full accent-primary cursor-ew-resize bg-muted h-1.5 rounded-lg"
      />
    </div>
  );
}

interface ThemePanelProps {
  theme: CVTheme;
  /** `reflow: true` quand le changement affecte les dimensions → réaligner. */
  onThemeChange: (updates: Partial<CVTheme>, opts?: { reflow?: boolean }) => void;
}

/** Bouton "Thème" de la toolbar canvas + popover de personnalisation
 *  (presets, couleurs, police, compétences, tailles, espacements). */
export function ThemePanel({ theme, onThemeChange }: ThemePanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
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

  const activeFont = theme.fontFamily ?? "sans";
  const activeSkillMode = theme.skillMode ?? "text";

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md transition-all shadow-sm h-6",
          open ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted/80 text-foreground"
        )}
        title="Thème & dimensions"
      >
        <Palette size={10} />
        <span className="hidden sm:inline">Thème</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-4 flex flex-col gap-4 cursor-default select-text max-h-[70vh] overflow-y-auto scrollbar-thin"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Presets — palettes 2 couleurs (accent + fond) */}
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const isActive =
                (theme.primaryColor ?? "#fbbf24").toLowerCase() === preset.primary.toLowerCase() &&
                (theme.sidebarBg ?? "#f4f4f5").toLowerCase() === preset.sidebarBg.toLowerCase();
              return (
                <button
                  key={preset.name}
                  type="button"
                  className={cn(
                    "relative flex flex-col gap-1 p-1.5 rounded-md border transition-colors text-left",
                    isActive ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"
                  )}
                  onClick={() =>
                    onThemeChange({
                      primaryColor: preset.primary,
                      sidebarBg: preset.sidebarBg,
                      textColor: preset.textColor,
                    })
                  }
                >
                  <span className="flex h-4 w-full rounded-sm overflow-hidden border border-border/40">
                    <span className="flex-1" style={{ backgroundColor: preset.primary }} />
                    <span className="flex-1" style={{ backgroundColor: preset.sidebarBg }} />
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">{preset.name}</span>
                  {isActive && (
                    <span className="absolute top-1 right-1 size-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Couleurs */}
          <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3">
            <ColorField label="Accent" value={theme.primaryColor || "#fbbf24"} swatches={QUICK_SWATCHES.accent} onChange={(v) => onThemeChange({ primaryColor: v })} />
            <ColorField label="Fond sidebar" value={theme.sidebarBg || "#f4f4f5"} swatches={QUICK_SWATCHES.sidebar} onChange={(v) => onThemeChange({ sidebarBg: v })} />
            <ColorField label="Texte" value={theme.textColor || "#27272a"} swatches={QUICK_SWATCHES.text} onChange={(v) => onThemeChange({ textColor: v })} />
            <ColorField label="Fond de page" value={theme.pageBg || "#ffffff"} swatches={QUICK_SWATCHES.page} onChange={(v) => onThemeChange({ pageBg: v })} />
          </div>

          {/* Police */}
          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Police</span>
            <div className="grid grid-cols-4 gap-1">
              {(Object.entries(FONT_FAMILIES) as Array<[CVFontFamily, { label: string; stack: string }]>).map(([key, font]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onThemeChange({ fontFamily: key }, { reflow: true })}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-1 py-1.5 rounded-md border transition-colors",
                    activeFont === key ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <span className="text-sm leading-none" style={{ fontFamily: font.stack }}>Aa</span>
                  <span className="text-[9px]">{font.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Compétences */}
          <div className="flex flex-col gap-1.5 border-t border-border/40 pt-3">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Compétences</span>
            <div className="grid grid-cols-3 gap-1">
              {SKILL_MODES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onThemeChange({ skillMode: value }, { reflow: true })}
                  className={cn(
                    "px-2 py-1 text-[10px] font-semibold rounded-md border transition-colors",
                    activeSkillMode === value ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensions */}
          <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
            <SliderField
              label="Taille du texte"
              value={theme.fontSize ?? 10}
              unit="pt"
              min={8}
              max={14}
              step={0.5}
              onChange={(v) => onThemeChange({ fontSize: v })}
              onCommit={() => onThemeChange({}, { reflow: true })}
            />
            <SliderField
              label="Taille des titres"
              value={theme.headingSize ?? 12}
              unit="pt"
              min={9}
              max={18}
              step={0.5}
              onChange={(v) => onThemeChange({ headingSize: v })}
              onCommit={() => onThemeChange({}, { reflow: true })}
            />
            <SliderField
              label="Espacement des sections"
              value={theme.sectionMargin ?? 8}
              unit="pt"
              min={2}
              max={24}
              step={1}
              onChange={(v) => onThemeChange({ sectionMargin: v })}
              onCommit={() => onThemeChange({}, { reflow: true })}
            />
            <SliderField
              label="Hauteur de ligne"
              value={theme.lineHeight ?? 1.2}
              min={1.0}
              max={1.6}
              step={0.05}
              onChange={(v) => onThemeChange({ lineHeight: v })}
              onCommit={() => onThemeChange({}, { reflow: true })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
