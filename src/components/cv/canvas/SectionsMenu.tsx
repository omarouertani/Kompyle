"use client";

import React, { useRef, useState } from "react";
import { useDismiss } from "@/hooks/use-dismiss";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { LayoutPanelLeft } from "lucide-react";
import type { CVData } from "@/types/cv";
import LayoutManager from "../LayoutManager";
import { toolbarPill } from "./toolbar-styles";

const PANEL_W = 288;

/** Bouton « Sections » de la barre d'outils du canvas : afficher / masquer,
 *  renommer les sections et ajouter une section libre (repris de l'ancien
 *  formulaire « Éditer le CV »). */
export function SectionsMenu({ data, onChange }: { data: CVData; onChange: (data: CVData) => void }) {
  const tu = useTranslations("UI");
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  /** Ouvre le panneau sous le bouton, sans jamais dépasser de la fenêtre. */
  const toggle = () => {
    if (open) return setOpen(false);
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8)) });
    setOpen(true);
  };

  // Clic ailleurs ou Échap : fermeture.
  useDismiss(open, () => setOpen(false), ref, panelRef);

  return (
    <div className="relative" ref={ref}>
      <button ref={buttonRef} type="button" onClick={toggle} className={toolbarPill(open)} title={tu("sections")} aria-expanded={open}>
        <LayoutPanelLeft size={10} />
        <span className="hidden sm:inline">{tu("sections")}</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: PANEL_W }}
          className="fixed z-50 flex max-h-[70vh] cursor-default flex-col overflow-y-auto rounded-2xl border border-border/70 bg-popover/95 p-3 shadow-2xl shadow-black/20 ring-1 ring-black/5 backdrop-blur-xl select-text"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <LayoutManager data={data} onChange={onChange} />
        </div>,
        document.body
      )}
    </div>
  );
}
