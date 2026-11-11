"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { FreeElement } from "@/types/cv";
import { stripDecl } from "./use-selection-format";
import { CV_ICON_STROKES } from "@/lib/cv-icons";

interface FreeElementStyleBarProps {
  el: FreeElement;
  /** Couleur de texte par défaut (thème), pour un texte sans couleur propre. */
  defaultTextColor: string;
  onPatch: (patch: Partial<FreeElement>) => void;
}

/** Retire les couleurs de texte internes (`color:` mais pas `background-color:`,
 *  et les `<font color>` d'execCommand) pour que la couleur de la zone s'applique partout. */
function stripTextColor(html: string): string {
  return stripDecl(html, "(?<![-a-z])color").replace(/<font\b[^>]*>|<\/font>/gi, "");
}

const STROKES =[0, 0.5, 1, 1.5, 2, 3, 4, 6];
const RADII = [0, 2, 4, 8, 12, 20];

/** Réglages de l'élément libre sélectionné : couleurs, trait, coins. */
export function FreeElementStyleBar({ el, defaultTextColor, onPatch }: FreeElementStyleBarProps) {
  const t = useTranslations("Canvas");
  if (el.kind === "image") return null; // rien à régler (taille : poignées du bloc)
  const color = (label: string, value: string, onValue: (v: string) => void) => (
    <label className="flex items-center gap-1">
      <span>{label}</span>
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
        onChange={(e) => onValue(e.target.value)}
        className="h-5 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
      />
    </label>
  );
  const select = (label: string, value: number, options: number[], onValue: (v: number) => void) => (
    <label className="flex items-center gap-1">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onValue(Number(e.target.value))}
        className="h-5 rounded border border-border bg-background px-1"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      data-canvas-toolbar
      className="absolute bottom-10 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-3 py-1.5 rounded-md bg-background/95 border border-border/80 shadow-md text-[10px] text-muted-foreground"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Texte : la couleur vaut pour toute la zone (les couleurs internes sont retirées). */}
      {el.kind === "text" && color(t("free_color"), el.color ?? defaultTextColor, (v) => onPatch({ color: v, html: stripTextColor(el.html ?? "") }))}
      {el.kind === "line" && (
        <>
          {color(t("free_color"), el.color ?? "#1a1a1a", (v) => onPatch({ color: v }))}
          {select(t("free_stroke_width"), el.strokeWidth ?? 1.5, STROKES.filter((s) => s > 0), (v) => onPatch({ strokeWidth: v }))}
        </>
      )}
      {el.kind === "icon" && (
        <>
          {color(t("free_color"), el.color ?? "#1a1a1a", (v) => onPatch({ color: v }))}
          {select(t("free_stroke_width"), el.strokeWidth ?? 2, CV_ICON_STROKES, (v) => onPatch({ strokeWidth: v }))}
        </>
      )}
      {(el.kind === "rect" || el.kind === "ellipse") && (
        <>
          {color(t("free_fill"), el.fill ?? "#ffffff", (v) => onPatch({ fill: v }))}
          <button
            type="button"
            className="rounded border border-border px-1 hover:bg-muted/80"
            onClick={() => onPatch({ fill: "transparent" })}
          >
            {t("free_no_fill")}
          </button>
          {color(t("free_stroke"), el.color ?? "#1a1a1a", (v) => onPatch({ color: v }))}
          {select(t("free_stroke_width"), el.strokeWidth ?? 0, STROKES, (v) => onPatch({ strokeWidth: v }))}
          {el.kind === "rect" && select(t("free_radius"), el.radius ?? 0, RADII, (v) => onPatch({ radius: v }))}
        </>
      )}
    </div>
  );
}
