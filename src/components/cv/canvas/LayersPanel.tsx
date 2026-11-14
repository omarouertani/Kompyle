"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Lock, LockOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type LayerColumn = "sidebar" | "main";

export interface LayerItem {
  id: string;
  label: string;
}

interface LayersPanelProps {
  /** Sections de la colonne latérale, de haut en bas (vide = modèle à une colonne). */
  sidebar: LayerItem[];
  /** Sections de la colonne principale, de haut en bas. */
  main: LayerItem[];
  /** Éléments libres (texte, formes, images) de la page active, de l'avant vers le fond. */
  free: LayerItem[];
  /** Le modèle a-t-il une colonne latérale ? */
  hasSidebar: boolean;
  selectedIds: string[];
  isHidden: (id: string) => boolean;
  isLocked: (id: string) => boolean;
  onSelect: (id: string) => void;
  /** Place la section `id` dans `column`, à l'index `index` (de haut en bas). */
  onMoveSection: (id: string, column: LayerColumn, index: number) => void;
  /** Élément libre `id` passé à la place de `overId` dans la superposition. */
  onMoveFree: (id: string, overId: string) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onClose: () => void;
}

const HEADER_SIDEBAR = "__col_sidebar";
const HEADER_MAIN = "__col_main";

/**
 * Panneau « Sections » : l'ordre des sections sur la page, par colonne.
 * Glisser une section la déplace dans le CV (y compris d'une colonne à
 * l'autre) ; œil = masquer, cadenas = verrouiller. Les éléments libres, eux,
 * se superposent : leur ordre = qui passe devant.
 */
export function LayersPanel({
  sidebar,
  main,
  free,
  hasSidebar,
  selectedIds,
  isHidden,
  isLocked,
  onSelect,
  onMoveSection,
  onMoveFree,
  onToggleHidden,
  onToggleLocked,
  onClose,
}: LayersPanelProps) {
  const tu = useTranslations("UI");
  const t = useTranslations("Canvas");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Liste à plat : [en-tête latérale, …sections, en-tête principale, …sections].
  // Les en-têtes ne se déplacent pas : ils indiquent la colonne de destination.
  const sectionRows = hasSidebar
    ? [HEADER_SIDEBAR, ...sidebar.map((s) => s.id), HEADER_MAIN, ...main.map((s) => s.id)]
    : main.map((s) => s.id);
  const labels = new Map([...sidebar, ...main, ...free].map((i) => [i.id, i.label]));

  const onSectionDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const id = String(active.id);
    const from = sectionRows.indexOf(id);
    const over_ = sectionRows.indexOf(String(over.id));
    if (from < 0 || over_ < 0) return;
    // Même ordre que l'aperçu animé de dnd-kit pendant le glisser.
    const next = arrayMove(sectionRows, from, over_);
    if (!hasSidebar) {
      onMoveSection(id, "main", next.indexOf(id));
      return;
    }
    const pos = next.indexOf(id);
    const mainHeader = next.indexOf(HEADER_MAIN);
    if (pos < mainHeader) {
      // Au-dessus de l'en-tête « principale » → colonne latérale (jamais avant son en-tête).
      const sidebarHeader = next.indexOf(HEADER_SIDEBAR);
      onMoveSection(id, "sidebar", Math.max(0, pos - sidebarHeader - 1));
    } else {
      onMoveSection(id, "main", pos - mainHeader - 1);
    }
  };

  const onFreeDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onMoveFree(String(active.id), String(over.id));
  };

  const rowProps = (id: string) => ({
    id,
    label: labels.get(id) ?? id,
    selected: selectedIds.includes(id),
    hidden: isHidden(id),
    locked: isLocked(id),
    onSelect: () => onSelect(id),
    onToggleHidden: () => onToggleHidden(id),
    onToggleLocked: () => onToggleLocked(id),
    hideLabel: t("layer_hide"),
    showLabel: t("layer_show"),
    lockLabel: t("layer_lock"),
    unlockLabel: t("layer_unlock"),
  });

  return (
    <div
      data-canvas-toolbar
      className="absolute right-2 top-14 z-[60] w-60 max-h-[70%] flex flex-col rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60">
        <span className="text-xs font-semibold">{t("sections_title")}</span>
        <button type="button" className="p-0.5 rounded hover:bg-muted" onClick={onClose} aria-label={tu("close")}>
          <X size={12} />
        </button>
      </div>
      <p className="px-2.5 pt-1.5 text-[10px] leading-snug text-muted-foreground">{t("sections_hint")}</p>
      <div className="overflow-y-auto p-1 scrollbar-thin">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
          <SortableContext items={sectionRows} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-px">
              {sectionRows.map((id) =>
                id === HEADER_SIDEBAR || id === HEADER_MAIN ? (
                  <ColumnHeader key={id} id={id} label={t(id === HEADER_SIDEBAR ? "column_sidebar" : "column_main")} />
                ) : (
                  <LayerRow key={id} {...rowProps(id)} />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>

        {free.length > 0 && (
          <>
            <p className="mt-2 px-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("free_elements")}</p>
            <p className="px-1.5 pb-1 text-[10px] text-muted-foreground">{t("free_elements_hint")}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFreeDragEnd}>
              <SortableContext items={free.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-px">
                  {free.map((f) => <LayerRow key={f.id} {...rowProps(f.id)} />)}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
    </div>
  );
}

/** En-tête de colonne : cible de dépôt, jamais déplaçable. */
function ColumnHeader({ id, label }: { id: string; label: string }) {
  const { setNodeRef } = useSortable({ id, disabled: true });
  return (
    <li ref={setNodeRef} className="mt-1 first:mt-0 px-1.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
    </li>
  );
}

interface LayerRowProps {
  id: string;
  label: string;
  selected: boolean;
  hidden: boolean;
  locked: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  hideLabel: string;
  showLabel: string;
  lockLabel: string;
  unlockLabel: string;
}

function LayerRow({ id, label, selected, hidden, locked, onSelect, onToggleHidden, onToggleLocked, hideLabel, showLabel, lockLabel, unlockLabel }: LayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    // Toute la ligne se glisse ; un simple clic sélectionne (seuil de 4 px).
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-center gap-1 rounded-md px-1 py-1 text-xs touch-none cursor-grab active:cursor-grabbing",
        selected ? "bg-primary/10 text-foreground" : "hover:bg-muted/70",
        isDragging && "relative z-10 opacity-80 shadow-md bg-popover",
      )}
      {...attributes}
      {...listeners}
    >
      <span className="text-muted-foreground" aria-hidden>
        <GripVertical size={12} />
      </span>
      <button type="button" className={cn("flex-1 truncate text-left", hidden && "opacity-50 line-through")} onClick={onSelect}>
        {label}
      </button>
      <button
        type="button"
        className="p-0.5 rounded hover:bg-muted"
        onClick={onToggleHidden}
        title={hidden ? showLabel : hideLabel}
        aria-label={hidden ? showLabel : hideLabel}
        aria-pressed={hidden}
      >
        {hidden ? <EyeOff size={12} /> : <Eye size={12} className="opacity-60" />}
      </button>
      <button
        type="button"
        className="p-0.5 rounded hover:bg-muted"
        onClick={onToggleLocked}
        title={locked ? unlockLabel : lockLabel}
        aria-label={locked ? unlockLabel : lockLabel}
        aria-pressed={locked}
      >
        {locked ? <Lock size={12} /> : <LockOpen size={12} className="opacity-60" />}
      </button>
    </li>
  );
}
