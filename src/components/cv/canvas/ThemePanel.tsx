"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CVTheme, CVFontFamily, SkillMode } from "@/types/cv";
import { Palette, Check, AlignLeft, Tags, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Ambre Doré", primary: "#fbbf24", sidebarBg: "#f4f4f5", textColor: "#27272a" },
  { name: "Bleu Corporate", primary: "#2563eb", sidebarBg: "#f8fafc", textColor: "#1e293b" },
  { name: "Vert Émeraude", primary: "#059669", sidebarBg: "#f0fdf4", textColor: "#0f5132" },
  { name: "Rouge Rubis", primary: "#dc2626", sidebarBg: "#fef2f2", textColor: "#7f1d1d" },
  { name: "Violet Indigo", primary: "#6366f1", sidebarBg: "#eef2ff", textColor: "#312e81" },
  { name: "Sombre Minimal", primary: "#18181b", sidebarBg: "#fafafa", textColor: "#27272a" },
];

/** Teintes rapides proposées sous chaque champ couleur. */
const QUICK_SWATCHES: Record<string, string[]> = {
  accent: ["#fbbf24", "#2563eb", "#059669", "#dc2626", "#6366f1"],
  sidebar: ["#f4f4f5", "#f8fafc", "#f0fdf4", "#fef2f2", "#eef2ff"],
  text: ["#27272a", "#1e293b", "#0f5132", "#7f1d1d", "#374151"],
  page: ["#ffffff", "#fdfcf7", "#f7f7f8", "#fbf8f1", "#f5f8fb"],
};

/** Polices disponibles sur le canvas (la clé est persistée dans theme.fontFamily). */
// Stacks alignées sur les polices PDF (src/utils/pdf-fonts.ts) pour que les
// métriques (chasse, ascendants/descendants) soient identiques canvas ↔ PDF :
//   sans  → Carlito          (PDF: Carlito)
//   serif → Times New Roman  (PDF: Times-Roman, standard PDF)
//   modern → Inter           (PDF: Inter — préchargée via next/font dans le layout)
//   mono  → Courier New      (PDF: Courier, standard PDF)
export const FONT_FAMILIES: Record<CVFontFamily, { label: string; stack: string }> = {
  sans: { label: "Sans", stack: "'Carlito', sans-serif" },
  serif: { label: "Serif", stack: "'Times New Roman', Times, serif" },
  modern: { label: "Modern", stack: "var(--font-inter), 'Inter', system-ui, sans-serif" },
  mono: { label: "Mono", stack: "'Courier New', Courier, monospace" },
};

/** Mode d'affichage des compétences — chaque mode a sa propre vignette visuelle. */
const SKILL_MODES: Array<{ value: SkillMode; label: string; icon: React.ElementType }> = [
  { value: "text", label: "Texte", icon: AlignLeft },
  { value: "tags", label: "Tags", icon: Tags },
  { value: "bars", label: "Barres", icon: BarChart3 },
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
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex items-center gap-2">
        {/* Swatch cliquable → ouvre le sélecteur natif */}
        <button
          type="button"
          className="size-7 rounded-lg border border-border/70 shrink-0 cursor-pointer shadow-sm ring-1 ring-inset ring-white/20 transition-transform hover:scale-105"
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
          className="w-full min-w-0 text-[10px] font-mono px-2 py-1 rounded-md border border-border/70 bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
      </div>
      {/* Teintes rapides */}
      <div className="flex gap-1.5">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "size-4 rounded-full border transition-transform hover:scale-125",
              value.toLowerCase() === c.toLowerCase() ? "border-foreground ring-2 ring-offset-1 ring-offset-popover ring-foreground/30" : "border-border/60"
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
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
        <span>{label}</span>
        <span className="font-mono text-[11px] font-bold text-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
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
        className="slider-premium w-full"
      />
    </div>
  );
}

/** Petite section avec titre discret pour structurer le popover. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[10px] font-bold text-foreground/80 uppercase tracking-widest">{title}</span>
      {children}
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
          className="absolute right-0 top-9 z-50 w-80 rounded-2xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-2xl shadow-black/20 ring-1 ring-black/5 p-5 flex flex-col gap-5 cursor-default select-text max-h-[76vh] overflow-y-auto scrollbar-thin"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-center gap-2 -mb-1">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette size={13} />
            </span>
            <span className="text-sm font-semibold text-foreground">Personnaliser le thème</span>
          </div>

          {/* Presets — palettes 2 couleurs (accent + fond) */}
          <Section title="Palettes">
            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map((preset) => {
                const isActive =
                  (theme.primaryColor ?? "#fbbf24").toLowerCase() === preset.primary.toLowerCase() &&
                  (theme.sidebarBg ?? "#f4f4f5").toLowerCase() === preset.sidebarBg.toLowerCase();
                return (
                  <button
                    key={preset.name}
                    type="button"
                    className={cn(
                      "group relative flex flex-col gap-1.5 p-2 rounded-xl border transition-all text-left",
                      isActive ? "border-primary bg-primary/5 shadow-sm" : "border-border/60 bg-card hover:border-border hover:shadow-sm hover:-translate-y-0.5"
                    )}
                    onClick={() =>
                      onThemeChange({
                        primaryColor: preset.primary,
                        sidebarBg: preset.sidebarBg,
                        textColor: preset.textColor,
                      })
                    }
                    title={preset.name}
                  >
                    <span className="flex h-7 w-full rounded-lg overflow-hidden border border-border/30 shadow-inner">
                      <span className="flex-[2]" style={{ backgroundColor: preset.primary }} />
                      <span className="flex-[3]" style={{ backgroundColor: preset.sidebarBg }} />
                    </span>
                    <span className="text-[9px] font-medium text-muted-foreground truncate leading-tight">{preset.name}</span>
                    {isActive && (
                      <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md ring-2 ring-popover">
                        <Check size={9} strokeWidth={3.5} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Couleurs — aération accrue entre les blocs */}
          <Section title="Couleurs">
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              <ColorField label="Accent" value={theme.primaryColor || "#fbbf24"} swatches={QUICK_SWATCHES.accent} onChange={(v) => onThemeChange({ primaryColor: v })} />
              <ColorField label="Fond sidebar" value={theme.sidebarBg || "#f4f4f5"} swatches={QUICK_SWATCHES.sidebar} onChange={(v) => onThemeChange({ sidebarBg: v })} />
              <ColorField label="Texte" value={theme.textColor || "#27272a"} swatches={QUICK_SWATCHES.text} onChange={(v) => onThemeChange({ textColor: v })} />
              <ColorField label="Fond de page" value={theme.pageBg || "#ffffff"} swatches={QUICK_SWATCHES.page} onChange={(v) => onThemeChange({ pageBg: v })} />
            </div>
          </Section>

          {/* Police */}
          <Section title="Police">
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(FONT_FAMILIES) as Array<[CVFontFamily, { label: string; stack: string }]>).map(([key, font]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onThemeChange({ fontFamily: key }, { reflow: true })}
                  className={cn(
                    "flex flex-col items-center gap-1 px-1 py-2 rounded-xl border transition-all",
                    activeFont === key ? "border-primary bg-primary/5 text-foreground shadow-sm" : "border-border/60 bg-card hover:border-border hover:bg-muted/40 text-muted-foreground"
                  )}
                >
                  <span className="text-base leading-none" style={{ fontFamily: font.stack }}>Aa</span>
                  <span className="text-[9px] font-medium">{font.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Compétences — vignettes illustrées plutôt que boutons texte */}
          <Section title="Style des compétences">
            <div className="grid grid-cols-3 gap-2">
              {SKILL_MODES.map(({ value, label, icon: Icon }) => {
                const active = activeSkillMode === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onThemeChange({ skillMode: value }, { reflow: true })}
                    className={cn(
                      "flex flex-col items-center gap-1.5 px-1 py-2.5 rounded-xl border transition-all",
                      active ? "border-primary bg-primary/5 text-foreground shadow-sm" : "border-border/60 bg-card hover:border-border hover:bg-muted/40 text-muted-foreground"
                    )}
                    title={label}
                  >
                    {/* Mini illustration du rendu */}
                    <span className={cn("flex items-center justify-center size-7 rounded-lg", active ? "bg-primary/10 text-primary" : "bg-muted/60")}>
                      <Icon size={15} />
                    </span>
                    <span className="text-[9px] font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Dimensions */}
          <Section title="Dimensions">
            <div className="flex flex-col gap-4">
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
                value={theme.lineHeight ?? 1.15}
                min={1.0}
                max={1.6}
                step={0.05}
                onChange={(v) => onThemeChange({ lineHeight: v })}
                onCommit={() => onThemeChange({}, { reflow: true })}
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
