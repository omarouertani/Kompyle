"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CVTheme } from "@/types/cv";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Or Chaima", primary: "#fbbf24", sidebarBg: "#f4f4f5", textColor: "#27272a" },
  { name: "Bleu Corporate", primary: "#2563eb", sidebarBg: "#f8fafc", textColor: "#1e293b" },
  { name: "Vert Émeraude", primary: "#059669", sidebarBg: "#f0fdf4", textColor: "#0f5132" },
  { name: "Rouge Rubis", primary: "#dc2626", sidebarBg: "#fef2f2", textColor: "#7f1d1d" },
  { name: "Sombre Minimal", primary: "#18181b", sidebarBg: "#fafafa", textColor: "#27272a" },
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 rounded cursor-pointer border border-border bg-transparent p-0"
        />
        <span className="text-[10px] font-mono text-muted-foreground truncate">{value}</span>
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
 *  (presets, couleurs, tailles, espacements). */
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
          className="absolute right-0 top-8 z-50 w-72 rounded-xl border border-border bg-popover shadow-lg p-4 flex flex-col gap-4 cursor-default select-text"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-muted/50 transition-colors"
                onClick={() =>
                  onThemeChange({
                    primaryColor: preset.primary,
                    sidebarBg: preset.sidebarBg,
                    textColor: preset.textColor,
                  })
                }
              >
                <span
                  className="size-2.5 rounded-full border border-border/40 shrink-0"
                  style={{ backgroundColor: preset.primary }}
                />
                <span className="text-[11px] text-muted-foreground">{preset.name}</span>
              </button>
            ))}
          </div>

          {/* Couleurs */}
          <div className="grid grid-cols-3 gap-3 border-t border-border/40 pt-3">
            <ColorField label="Accent" value={theme.primaryColor || "#fbbf24"} onChange={(v) => onThemeChange({ primaryColor: v })} />
            <ColorField label="Fond" value={theme.sidebarBg || "#f4f4f5"} onChange={(v) => onThemeChange({ sidebarBg: v })} />
            <ColorField label="Texte" value={theme.textColor || "#27272a"} onChange={(v) => onThemeChange({ textColor: v })} />
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
