"use client";

import { useTranslations } from "next-intl";
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
import { stripHtml } from "@/utils/strip-html";
import { Eye, EyeOff, Trash2, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const tu = useTranslations("UI");
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

  // Sections qui vivent naturellement dans la barre latérale (mise en page à deux
  // colonnes). Réafficher l'une d'elles la remet dans la SIDEBAR plutôt qu'en
  // colonne principale — avant, tout revenait toujours en colonne principale,
  // même une section qui était en barre latérale.
  const SIDEBAR_SECTIONS = new Set(["contact", "skills", "languages", "education", "certifications", "interests"]);
  const hasSidebar = pages.some((p) => p.sidebar.length > 0);

  const show = (id: string) => {
    const toSidebar = hasSidebar && SIDEBAR_SECTIONS.has(id);
    const first = toSidebar
      ? { ...pages[0], sidebar: [...pages[0].sidebar, id] }
      : { ...pages[0], main: [...pages[0].main, id] };
    commitPages([first, ...pages.slice(1)]);
  };

  // Sections affichées dans le panneau : built-in + customs, visibles d'abord
  const customIds = (data.customSections ?? []).map((c) => `custom_${c.id}`);
  const allIds = [...ALL_SECTION_IDS, ...customIds];
  const sortedIds = [...allIds].sort((a, b) => Number(visible.has(b)) - Number(visible.has(a)));

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-1.5 text-[11px] leading-snug text-muted-foreground">{tu("sections_hint")}</p>
      {sortedIds.map((id) => {
        const isVisible = visible.has(id);
        const isCustom = id.startsWith("custom_");
        return (
          <div
            key={id}
            className={cn(
              "flex items-center gap-1 rounded-lg border border-border/60 bg-card px-2 py-1 transition-opacity",
              !isVisible && "opacity-55"
            )}
          >
            <input
              value={stripHtml(getSectionLabel(id, data))}
              onChange={(e) => onChange(renameSection(data, id, e.target.value))}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium transition-colors hover:border-border/70 focus:border-ring/40 focus:bg-input-bg focus:outline-none"
              title={tu("rename_section")}
              spellCheck={false}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground"
              title={isVisible ? tu("hide") : tu("show")}
              aria-label={isVisible ? tu("hide") : tu("show")}
              onClick={() => (isVisible ? hide(id) : show(id))}
            >
              {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
            </Button>
            {isCustom && (
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title={tu("delete_section")}
                aria-label={tu("delete_section")}
                onClick={() => onChange(removeCustomSection(data, id))}
              >
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="mt-1 w-full gap-1.5 border-dashed text-xs text-muted-foreground hover:text-foreground"
        title={tu("add_custom_hint")}
        onClick={() => onChange(addCustomSection(data))}
      >
        <SquarePlus size={13} /> {tu("add_custom_section")}
      </Button>
    </div>
  );
}
