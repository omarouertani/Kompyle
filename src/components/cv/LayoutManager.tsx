"use client";

import React from "react";
import type { CVData, LayoutPage } from "@/types/cv";
import {
  defaultLayout,
  emptyLayoutPage,
  ALL_SECTION_IDS,
  getSectionLabel,
  addCustomSection,
  removeCustomSection,
  renameSection,
  dedupePages,
} from "@/lib/cv-layout";
import { Eye, EyeOff, Trash2, LayoutPanelLeft, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Gestion des SECTIONS uniquement : visibilité, renommage, sections libres.
 * Tout le reste (réordonner, changer de colonne/page, thème, pages) se fait
 * directement dans le canvas — glisser-déposer, clic droit, bouton "Thème".
 */
export default function LayoutManager({
  data,
  onChange,
}: {
  data: CVData;
  onChange: (data: CVData) => void;
}) {
  const layout = data.layout ?? defaultLayout();
  const pages: LayoutPage[] = layout.pages.length > 0 ? layout.pages : [emptyLayoutPage()];

  const commitPages = (nextPages: LayoutPage[]) =>
    onChange({ ...data, layout: { ...layout, pages: dedupePages(nextPages) } });

  const visible = new Set<string>();
  for (const p of pages) {
    for (const id of p.main) visible.add(id);
    for (const id of p.sidebar) visible.add(id);
  }

  const hide = (id: string) =>
    commitPages(
      pages.map((p) => ({
        main: p.main.filter((s) => s !== id),
        sidebar: p.sidebar.filter((s) => s !== id),
      }))
    );

  const show = (id: string) =>
    commitPages([{ ...pages[0], main: [...pages[0].main, id] }, ...pages.slice(1)]);

  // Sections affichées dans le panneau : built-in + customs, visibles d'abord
  const customIds = (data.customSections ?? []).map((c) => `custom_${c.id}`);
  const allIds = [...ALL_SECTION_IDS, ...customIds];
  const sortedIds = [...allIds].sort((a, b) => Number(visible.has(b)) - Number(visible.has(a)));

  return (
    <section className="mb-4">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground mb-1 pb-2.5 border-b border-border">
        <LayoutPanelLeft size={18} className="text-primary" />
        Sections
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Activez/désactivez et renommez vos sections ici. L&apos;ordre, les colonnes, les pages
        et le thème se gèrent directement dans le canvas (glisser, clic droit, bouton Thème).
      </p>

      <div className="flex flex-col">
        {sortedIds.map((id) => {
          const isVisible = visible.has(id);
          const isCustom = id.startsWith("custom_");
          return (
            <div
              key={id}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-md mb-1.5 shadow-sm shadow-black/[0.03] transition-opacity ${isVisible ? "" : "opacity-55"}`}
            >
              <input
                value={getSectionLabel(id, data)}
                onChange={(e) => onChange(renameSection(data, id, e.target.value))}
                className="flex-1 text-sm font-medium min-w-0 bg-transparent rounded px-1 py-0.5 border border-transparent hover:border-border/70 focus:border-ring/40 focus:bg-input-bg focus:outline-none transition-colors"
                title="Renommer la section"
                spellCheck={false}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground"
                title={isVisible ? "Masquer" : "Afficher"}
                onClick={() => (isVisible ? hide(id) : show(id))}
              >
                {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
              </Button>
              {isCustom && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Supprimer la section"
                  onClick={() => onChange(removeCustomSection(data, id))}
                >
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="w-full mt-1 gap-2 text-muted-foreground hover:text-foreground border-dashed"
        title="Crée une section libre (titre + texte) modifiable dans le canvas"
        onClick={() => onChange(addCustomSection(data))}
      >
        <SquarePlus size={15} /> Ajouter une section libre
      </Button>
    </section>
  );
}
