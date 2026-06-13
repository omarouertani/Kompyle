"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, Trash2, Sparkles, FilePlus, RotateCcw, Grid3x3, FileDown, ImageDown, Loader2 } from "lucide-react";
import type { CVTheme } from "@/types/cv";
import { ThemePanel } from "./ThemePanel";

export type CanvasBackground = "neutral" | "dots" | "grid";

const BG_LABELS: Record<CanvasBackground, string> = {
  neutral: "Fond : neutre",
  dots: "Fond : points",
  grid: "Fond : quadrillage",
};

interface CanvasToolbarProps {
  pageCount: number;
  activePageIndex: number;
  zoom: number;
  theme: CVTheme;
  canvasBg: CanvasBackground;
  isExporting: boolean;
  onThemeChange: (updates: Partial<CVTheme>, opts?: { reflow?: boolean }) => void;
  onSelectPage: (index: number) => void;
  onAddPage: () => void;
  onRemovePage: () => void;
  onZoomChange: (zoom: number) => void;
  onZoomFit: () => void;
  onRealign: () => void;
  onCanvasBgChange: (bg: CanvasBackground) => void;
  onExportPdf: () => void;
  onExportPng: () => void;
}

export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 2.5;

export function CanvasToolbar({
  pageCount,
  activePageIndex,
  zoom,
  theme,
  canvasBg,
  isExporting,
  onThemeChange,
  onSelectPage,
  onAddPage,
  onRemovePage,
  onZoomChange,
  onZoomFit,
  onRealign,
  onCanvasBgChange,
  onExportPdf,
  onExportPng,
}: CanvasToolbarProps) {
  const cycleBg = () => {
    const order: CanvasBackground[] = ["neutral", "dots", "grid"];
    onCanvasBgChange(order[(order.indexOf(canvasBg) + 1) % order.length]);
  };

  return (
    <div data-canvas-toolbar className="p-3 border-b border-border/45 bg-background/95 backdrop-blur-md z-20 shrink-0 w-full flex items-center justify-between gap-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles size={13} className="text-primary shrink-0" />
        <span className="hidden xl:inline"><b>Canvas :</b> Glissez pour déplacer · <b>Ctrl+Z</b> annuler · <b>Ctrl+D</b> dupliquer · clic droit pour plus.</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Pages */}
        <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg border border-border/80 shadow-sm">
          {Array.from({ length: pageCount }, (_, idx) => (
            <button key={idx} type="button" onClick={() => onSelectPage(idx)} className={cn("px-2 py-0.5 text-[9px] font-semibold rounded-md transition-all h-6", activePageIndex === idx ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              P{idx + 1}
            </button>
          ))}
          <button type="button" onClick={onAddPage} className="p-1 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center rounded" title="Ajouter page">
            <FilePlus size={11} />
          </button>
          {pageCount > 1 && (
            <button type="button" onClick={onRemovePage} className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive h-6 w-6 flex items-center justify-center rounded" title="Supprimer page">
              <Trash2 size={11} />
            </button>
          )}
        </div>

        {/* Thème + Fond + Réaligner + Zoom */}
        <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg border border-border/80 shadow-sm">
          <ThemePanel theme={theme} onThemeChange={onThemeChange} />
          <div className="w-px h-3 bg-border/60 mx-0.5" />
          <button
            type="button"
            onClick={cycleBg}
            className={cn(
              "p-1 h-6 w-6 flex items-center justify-center rounded transition-colors",
              canvasBg !== "neutral" ? "bg-background text-foreground shadow-sm" : "hover:bg-background/80 text-muted-foreground hover:text-foreground"
            )}
            title={BG_LABELS[canvasBg]}
          >
            <Grid3x3 size={11} />
          </button>
          <button type="button" onClick={onRealign} className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md bg-background hover:bg-muted/80 text-foreground transition-all shadow-sm h-6" title="Réaligner tous les blocs">
            <RotateCcw size={10} />
            <span className="hidden sm:inline">Réaligner</span>
          </button>
          <div className="w-px h-3 bg-border/60 mx-0.5" />
          <button type="button" onClick={() => onZoomChange(Math.max(ZOOM_MIN, zoom - 0.1))} className="p-1 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center rounded">
            <Minus size={11} />
          </button>
          <span className="text-[10px] font-mono font-medium min-w-[32px] text-center text-foreground">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => onZoomChange(Math.min(ZOOM_MAX, zoom + 0.1))} className="p-1 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center rounded">
            <Plus size={11} />
          </button>
          <button type="button" onClick={onZoomFit} className="px-1.5 py-0.5 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 text-[9px] font-medium flex items-center justify-center rounded" title="Adapter à l'écran">
            Ajuster
          </button>
        </div>

        {/* Export — PDF en CTA accentué, PNG en action secondaire */}
        <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg border border-border/80 shadow-sm">
          <button
            type="button"
            onClick={onExportPng}
            disabled={isExporting}
            className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md bg-background hover:bg-muted/80 text-foreground transition-all shadow-sm h-6 disabled:opacity-50"
            title="Exporter la page active en PNG"
          >
            <ImageDown size={10} />
            <span className="hidden sm:inline">PNG</span>
          </button>
          <div className="w-px h-3 bg-border/60 mx-0.5" />
          <button
            type="button"
            onClick={onExportPdf}
            disabled={isExporting}
            className="flex items-center gap-1 px-2.5 py-0.5 text-[9px] font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shadow-primary/25 h-6 disabled:opacity-50"
            title="Exporter en PDF"
          >
            {isExporting ? <Loader2 size={10} className="animate-spin" /> : <FileDown size={10} />}
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
