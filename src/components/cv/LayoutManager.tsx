"use client";

import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CVData, LayoutPage, CVTheme } from "@/types/cv";
import {
  defaultLayout,
  emptyLayoutPage,
  ALL_SECTION_IDS,
  SECTION_LABELS,
  getSectionLabel,
  addCustomSection,
  removeCustomSection,
} from "@/lib/cv-layout";
import { GripVertical, ArrowLeftRight, EyeOff, Plus, Trash2, LayoutPanelLeft, FilePlus, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Col = "main" | "sidebar";

function SectionRow({
  id,
  label,
  pageIndex,
  totalPages,
  onMoveColumn,
  onMoveToPage,
  onHide,
  onDelete,
}: {
  id: string;
  label: string;
  pageIndex: number;
  totalPages: number;
  onMoveColumn: () => void;
  onMoveToPage: (target: number) => void;
  onHide: () => void;
  /** Suppression définitive — sections personnalisées uniquement. */
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 px-2.5 py-2 bg-card border border-border rounded-md mb-1.5 shadow-sm shadow-black/[0.03]">
      <span {...attributes} {...listeners} className="cursor-grab text-muted-foreground/50 hover:text-muted-foreground transition-colors">
        <GripVertical size={14} />
      </span>
      <span className="flex-1 text-sm font-medium min-w-0 truncate">{label}</span>
      {totalPages > 1 && (
        <select
          value={pageIndex}
          title="Déplacer vers la page…"
          className="text-xs px-1.5 py-1 border border-border rounded-md bg-input-bg text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring/30"
          onChange={(e) => onMoveToPage(Number(e.target.value))}
        >
          {Array.from({ length: totalPages }).map((_, p) => (
            <option key={p} value={p}>
              P{p + 1}
            </option>
          ))}
        </select>
      )}
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Changer de colonne" onClick={onMoveColumn}>
        <ArrowLeftRight size={13} />
      </Button>
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Masquer" onClick={onHide}>
        <EyeOff size={13} />
      </Button>
      {onDelete && (
        <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Supprimer la section" onClick={onDelete}>
          <Trash2 size={13} />
        </Button>
      )}
    </div>
  );
}

export default function LayoutManager({
  data,
  onChange,
}: {
  data: CVData;
  onChange: (data: CVData) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const layout = data.layout ?? defaultLayout();
  const pages: LayoutPage[] = layout.pages.length > 0 ? layout.pages : [emptyLayoutPage()];

  const commitPages = (nextPages: LayoutPage[]) =>
    onChange({ ...data, layout: { ...layout, pages: nextPages } });

  const updatePage = (pageIndex: number, next: LayoutPage) =>
    commitPages(pages.map((p, i) => (i === pageIndex ? next : p)));

  const addPage = () => commitPages([...pages, emptyLayoutPage()]);

  const removePage = (pageIndex: number) => {
    if (pages.length <= 1) return;
    commitPages(pages.filter((_, i) => i !== pageIndex));
  };

  const handleDragEnd = (pageIndex: number, col: Col) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const page = pages[pageIndex];
    const ids = page[col];
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const moved = arrayMove(ids, oldIndex, newIndex);
    updatePage(pageIndex, col === "main" ? { ...page, main: moved } : { ...page, sidebar: moved });
  };

  const moveColumn = (pageIndex: number, col: Col, id: string) => {
    const page = pages[pageIndex];
    const without = page[col].filter((s) => s !== id);
    if (col === "main") {
      updatePage(pageIndex, { ...page, main: without, sidebar: [...page.sidebar, id] });
    } else {
      updatePage(pageIndex, { ...page, sidebar: without, main: [...page.main, id] });
    }
  };

  const moveToPage = (fromPage: number, col: Col, id: string, toPage: number) => {
    if (fromPage === toPage) return;
    const next = pages.map((p, i) => {
      if (i === fromPage) {
        return col === "main" ? { ...p, main: p.main.filter((s) => s !== id) } : { ...p, sidebar: p.sidebar.filter((s) => s !== id) };
      }
      if (i === toPage) {
        return col === "main" ? { ...p, main: [...p.main, id] } : { ...p, sidebar: [...p.sidebar, id] };
      }
      return p;
    });
    commitPages(next);
  };

  const hide = (pageIndex: number, id: string) => {
    const page = pages[pageIndex];
    updatePage(pageIndex, {
      ...page,
      main: page.main.filter((s) => s !== id),
      sidebar: page.sidebar.filter((s) => s !== id),
    });
  };

  const show = (id: string) => updatePage(0, { ...pages[0], main: [...pages[0].main, id] });

  const visible = new Set<string>();
  for (const p of pages) {
    for (const id of p.main) visible.add(id);
    for (const id of p.sidebar) visible.add(id);
  }
  const hidden = ALL_SECTION_IDS.filter((id) => !visible.has(id));

  const renderColumn = (pageIndex: number, col: Col) => {
    const ids = pages[pageIndex][col].filter((id) => id in SECTION_LABELS || id.startsWith("custom_"));
    return (
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          {col === "main" ? "Principale" : "Latérale"}
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd(pageIndex, col)}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {ids.map((id) => (
              <SectionRow
                key={id}
                id={id}
                label={getSectionLabel(id, data)}
                pageIndex={pageIndex}
                totalPages={pages.length}
                onMoveColumn={() => moveColumn(pageIndex, col, id)}
                onMoveToPage={(target) => moveToPage(pageIndex, col, id, target)}
                onHide={() => hide(pageIndex, id)}
                onDelete={id.startsWith("custom_") ? () => onChange(removeCustomSection(data, id)) : undefined}
              />
            ))}
            {ids.length === 0 && (
              <div className="text-xs text-muted-foreground/60 italic py-2 text-center">Vide</div>
            )}
          </SortableContext>
        </DndContext>
      </div>
    );
  };

  return (
    <section className="mb-4">
      <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground mb-1 pb-2.5 border-b border-border">
        <LayoutPanelLeft size={18} className="text-primary" />
        Mise en page
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        Glisse pour réordonner, ⇄ colonne, P▾ pour changer de page, 🚫 pour masquer.
      </p>

      {pages.map((_, pageIndex) => (
        <div
          key={pageIndex}
          className="border border-border rounded-lg p-3 mb-2.5 bg-muted/20"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-foreground">Page {pageIndex + 1}</span>
            {pages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Supprimer la page"
                onClick={() => removePage(pageIndex)}
              >
                <Trash2 size={13} />
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {renderColumn(pageIndex, "main")}
            {renderColumn(pageIndex, "sidebar")}
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1 gap-2 text-muted-foreground hover:text-foreground" onClick={addPage}>
          <FilePlus size={15} /> Ajouter une page
        </Button>
        <Button
          variant="outline"
          className="flex-1 gap-2 text-muted-foreground hover:text-foreground"
          title="Crée une section libre (titre + texte) modifiable dans le canvas"
          onClick={() => onChange(addCustomSection(data))}
        >
          <SquarePlus size={15} /> Ajouter une section
        </Button>
      </div>

      {hidden.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Sections masquées</div>
          <div className="flex flex-wrap gap-1.5">
            {hidden.map((id) => (
              <Button
                key={id}
                variant="secondary"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => show(id)}
              >
                <Plus size={12} /> {SECTION_LABELS[id]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* ── Personnalisation du Thème ── */}
      <div className="mt-8 pt-6 border-t border-border">
        {(() => {
          const theme = layout.theme || {};
          const updateTheme = (updatedTheme: Partial<CVTheme>) => {
            onChange({
              ...data,
              layout: {
                ...layout,
                theme: {
                  ...theme,
                  ...updatedTheme,
                },
              },
            });
          };

          return (
            <>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <span>Thème & Spécifications</span>
              </h3>
              
              {/* Presets */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { name: "Or Chaima", primary: "#fbbf24", sidebarBg: "#f4f4f5", textColor: "#27272a" },
                  { name: "Bleu Corporate", primary: "#2563eb", sidebarBg: "#f8fafc", textColor: "#1e293b" },
                  { name: "Vert Émeraude", primary: "#059669", sidebarBg: "#f0fdf4", textColor: "#0f5132" },
                  { name: "Rouge Rubis", primary: "#dc2626", sidebarBg: "#fef2f2", textColor: "#7f1d1d" },
                  { name: "Sombre Minimal", primary: "#18181b", sidebarBg: "#fafafa", textColor: "#27272a" },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      updateTheme({
                        primaryColor: preset.primary,
                        sidebarBg: preset.sidebarBg,
                        textColor: preset.textColor,
                      });
                    }}
                  >
                    <span className="size-2.5 rounded-full border border-border/40 shrink-0" style={{ backgroundColor: preset.primary }} />
                    <span className="text-[11px] text-muted-foreground">{preset.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom Pickers */}
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Accent</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={theme.primaryColor || "#fbbf24"}
                      onChange={(e) => updateTheme({ primaryColor: e.target.value })}
                      className="size-7 rounded cursor-pointer border border-border bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground truncate">{theme.primaryColor || "#fbbf24"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Fond</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={theme.sidebarBg || "#f4f4f5"}
                      onChange={(e) => updateTheme({ sidebarBg: e.target.value })}
                      className="size-7 rounded cursor-pointer border border-border bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground truncate">{theme.sidebarBg || "#f4f4f5"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase">Texte</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={theme.textColor || "#27272a"}
                      onChange={(e) => updateTheme({ textColor: e.target.value })}
                      className="size-7 rounded cursor-pointer border border-border bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono text-muted-foreground truncate">{theme.textColor || "#27272a"}</span>
                  </div>
                </div>
              </div>

              {/* Sliders de dimensions */}
              <div className="space-y-4 border-t border-border/40 pt-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase">
                    <span>Taille du texte</span>
                    <span className="font-mono text-xs text-foreground">{theme.fontSize !== undefined ? theme.fontSize : 10} pt</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="14"
                    step="0.5"
                    value={theme.fontSize !== undefined ? theme.fontSize : 10}
                    onChange={(e) => updateTheme({ fontSize: Number(e.target.value) })}
                    className="w-full accent-primary cursor-ew-resize bg-muted h-1.5 rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase">
                    <span>Taille des titres</span>
                    <span className="font-mono text-xs text-foreground">{theme.headingSize !== undefined ? theme.headingSize : 12} pt</span>
                  </div>
                  <input
                    type="range"
                    min="9"
                    max="18"
                    step="0.5"
                    value={theme.headingSize !== undefined ? theme.headingSize : 12}
                    onChange={(e) => updateTheme({ headingSize: Number(e.target.value) })}
                    className="w-full accent-primary cursor-ew-resize bg-muted h-1.5 rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase">
                    <span>Espacement des sections</span>
                    <span className="font-mono text-xs text-foreground">{theme.sectionMargin !== undefined ? theme.sectionMargin : 12} pt</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    step="1"
                    value={theme.sectionMargin !== undefined ? theme.sectionMargin : 12}
                    onChange={(e) => updateTheme({ sectionMargin: Number(e.target.value) })}
                    className="w-full accent-primary cursor-ew-resize bg-muted h-1.5 rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-muted-foreground uppercase">
                    <span>Hauteur de ligne</span>
                    <span className="font-mono text-xs text-foreground">{theme.lineHeight !== undefined ? theme.lineHeight : 1.25}</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="1.6"
                    step="0.05"
                    value={theme.lineHeight !== undefined ? theme.lineHeight : 1.25}
                    onChange={(e) => updateTheme({ lineHeight: Number(e.target.value) })}
                    className="w-full accent-primary cursor-ew-resize bg-muted h-1.5 rounded-lg"
                  />
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </section>
  );
}
