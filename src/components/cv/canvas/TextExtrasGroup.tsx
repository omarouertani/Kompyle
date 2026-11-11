"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Highlighter, Link2, Unlink, RemoveFormatting, ListOrdered, MoveVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useCanvasFormat } from "./use-canvas-format";

type FormatApi = ReturnType<typeof useCanvasFormat>;

/** Couleurs de surlignage proposées (claires, lisibles sous du texte foncé). */
const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff"];
const LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 2];
const LETTER_SPACINGS = [-0.5, 0, 0.5, 1, 2];

/** Protocoles acceptés pour un lien (mêmes règles que le sanitizer / le PDF). */
const SAFE_HREF_RE = /^(https?:|mailto:|tel:)/i;

/** Normalise une saisie de lien : ajoute https:// à un domaine nu, mailto: à une
 *  adresse e-mail ; renvoie null si le protocole n'est pas autorisé. */
export function normalizeLinkInput(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (SAFE_HREF_RE.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return null; // javascript:, data:, …
  if (/^[^\s]+\.[^\s]+$/.test(v)) return `https://${v}`;
  return null;
}

interface TextExtrasGroupProps {
  fmt: FormatApi;
  /** Applique à la sélection de texte, sinon aux blocs sélectionnés (cf. CanvasToolbar). */
  applyFmt: (editorRun: () => boolean, blockRun: () => boolean, reflow?: boolean) => boolean;
  onBlockCommand?: (command: string, value?: string) => boolean;
  onBlockStyles?: (styles: Record<string, string>) => boolean;
  onReflow?: () => void;
  ToolButton: React.ComponentType<{
    children: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
    disabled?: boolean;
    title?: string;
    className?: string;
  }>;
}

/** Contrôles de texte supplémentaires de la barre d'outils : liste numérotée,
 *  surlignage, lien, interligne / espacement des lettres, effacer la mise en forme. */
export function TextExtrasGroup({ fmt, applyFmt, onBlockCommand, onBlockStyles, onReflow, ToolButton }: TextExtrasGroupProps) {
  const t = useTranslations("Canvas");
  const [open, setOpen] = useState<null | "highlight" | "link" | "spacing">(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState(false);
  const toggle = (k: "highlight" | "link" | "spacing") => setOpen((o) => (o === k ? null : k));

  const applyHighlight = (color: string) => {
    applyFmt(() => fmt.exec("hiliteColor", color), () => onBlockCommand?.("hiliteColor", color) ?? false);
    setOpen(null);
  };

  const applyLink = () => {
    const href = normalizeLinkInput(linkDraft);
    if (!href) {
      setLinkError(true);
      return;
    }
    // Un lien n'a de sens que sur du texte sélectionné dans un éditeur.
    if (fmt.exec("createLink", href)) {
      setOpen(null);
      setLinkDraft("");
      setLinkError(false);
    } else {
      setLinkError(true);
    }
  };

  const applySpacing = (prop: "line-height" | "letter-spacing", value: string) => {
    applyFmt(() => fmt.applyInlineStyle(prop, value), () => onBlockStyles?.({ [prop]: value }) ?? false, true);
  };

  const clear = () => {
    applyFmt(() => fmt.exec("removeFormat"), () => onBlockCommand?.("removeFormat") ?? false, true);
  };

  return (
    <div className="relative flex items-center gap-0.5">
      <ToolButton
        title={t("format_list_ordered")}
        onClick={() => { if (fmt.exec("insertOrderedList")) onReflow?.(); }}
      >
        <ListOrdered size={13} />
      </ToolButton>
      <ToolButton title={t("format_highlight")} active={open === "highlight"} onClick={() => toggle("highlight")}>
        <Highlighter size={13} />
      </ToolButton>
      <ToolButton
        title={fmt.state.hasSelection ? t("format_link") : t("format_link_hint")}
        active={open === "link"}
        disabled={!fmt.state.hasActiveEditor}
        onClick={() => { setLinkError(false); toggle("link"); }}
      >
        <Link2 size={13} />
      </ToolButton>
      <ToolButton title={t("format_spacing")} active={open === "spacing"} onClick={() => toggle("spacing")}>
        <MoveVertical size={13} />
      </ToolButton>
      <ToolButton title={t("format_clear")} onClick={clear}>
        <RemoveFormatting size={13} />
      </ToolButton>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(null)} />
          <div
            className="absolute left-0 top-8 z-40 rounded-lg border border-border bg-popover shadow-lg motion-pop p-2 text-[11px] text-foreground"
            onMouseDown={(e) => {
              // Ne pas voler le focus de l'éditeur, sauf pour le champ du lien.
              if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
          >
            {open === "highlight" && (
              <div className="flex items-center gap-1.5">
                {HIGHLIGHTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => applyHighlight(c)}
                    className="size-6 rounded-md border border-border/70 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => applyHighlight("transparent")}
                  className="h-6 px-2 rounded-md border border-border/70 hover:bg-muted/60"
                >
                  {t("format_highlight_none")}
                </button>
              </div>
            )}

            {open === "link" && (
              <div className="flex flex-col gap-1.5 w-60">
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={linkDraft}
                    placeholder="https://…"
                    onChange={(e) => { setLinkDraft(e.target.value); setLinkError(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setOpen(null); }}
                    className={cn(
                      "h-7 flex-1 min-w-0 px-2 rounded-md border bg-background outline-none focus:ring-2 focus:ring-primary/30",
                      linkError ? "border-destructive" : "border-border/70",
                    )}
                  />
                  <button type="button" onClick={applyLink} className="h-7 px-2 rounded-md bg-primary text-primary-foreground font-semibold">
                    {t("format_link_apply")}
                  </button>
                  <button
                    type="button"
                    title={t("format_unlink")}
                    onClick={() => { fmt.exec("unlink"); setOpen(null); }}
                    className="h-7 w-7 flex items-center justify-center rounded-md border border-border/70 hover:bg-muted/60"
                  >
                    <Unlink size={12} />
                  </button>
                </div>
                <span className={cn("text-[10px]", linkError ? "text-destructive" : "text-muted-foreground")}>
                  {linkError ? t("format_link_error") : t("format_link_hint")}
                </span>
              </div>
            )}

            {open === "spacing" && (
              <div className="flex flex-col gap-2 w-56">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t("format_line_height")}</span>
                <div className="flex gap-1">
                  {LINE_HEIGHTS.map((v) => (
                    <button key={v} type="button" onClick={() => applySpacing("line-height", String(v))} className="h-7 flex-1 rounded-md border border-border/70 hover:bg-muted/60 font-mono">
                      {v}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{t("format_letter_spacing")}</span>
                <div className="flex gap-1">
                  {LETTER_SPACINGS.map((v) => (
                    <button key={v} type="button" onClick={() => applySpacing("letter-spacing", `${v}pt`)} className="h-7 flex-1 rounded-md border border-border/70 hover:bg-muted/60 font-mono">
                      {v > 0 ? `+${v}` : v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
