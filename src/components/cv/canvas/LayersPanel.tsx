"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical, Lock, LockOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayersPanelProps {
  pageIndex: number;
  /** Blocs de la page, du fond vers l'avant. */
  stack: string[];
  selectedIds: string[];
  labelOf: (id: string) => string;
  isHidden: (id: string) => boolean;
  isLocked: (id: string) => boolean;
  onSelect: (id: string) => void;
  /** Déplace `id` à l'index `to` de la pile (du fond vers l'avant). */
  onMove: (id: string, to: number) => void;
  onToggleHidden: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onClose: () => void;
}

/** Panneau de calques de la page active : le haut de la liste est devant.
 *  Glisser une ligne la réordonne ; œil = masquer, cadenas = verrouiller. */
export function LayersPanel({
  pageIndex,
  stack,
  selectedIds,
  labelOf,
  isHidden,
  isLocked,
  onSelect,
  onMove,
  onToggleHidden,
  onToggleLocked,
  onClose,
}: LayersPanelProps) {
  const t = useTranslations("Canvas");
  const rows = [...stack].reverse();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const displayTo = rows.indexOf(String(over.id));
    if (displayTo < 0) return;
    onMove(String(active.id), rows.length - 1 - displayTo);
  };

  return (
    <div
      data-canvas-toolbar
      className="absolute right-2 top-14 z-[60] w-56 max-h-[70%] flex flex-col rounded-xl border border-border/70 bg-popover/95 backdrop-blur-xl shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/60">
        <span className="text-xs font-semibold">{t("layers_title", { page: pageIndex + 1 })}</span>
        <button type="button" className="p-0.5 rounded hover:bg-muted" onClick={onClose} aria-label="Close">
          <X size={12} />
        </button>
      </div>
      <p className="px-2.5 pt-1.5 text-[10px] text-muted-foreground">{t("layers_hint")}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rows} strategy={verticalListSortingStrategy}>
          <ul className="overflow-y-auto p-1 flex flex-col gap-px scrollbar-thin">
            {rows.map((id) => (
              <LayerRow
                key={id}
                id={id}
                label={labelOf(id)}
                selected={selectedIds.includes(id)}
                hidden={isHidden(id)}
                locked={isLocked(id)}
                onSelect={() => onSelect(id)}
                onToggleHidden={() => onToggleHidden(id)}
                onToggleLocked={() => onToggleLocked(id)}
                hideLabel={t("layer_hide")}
                showLabel={t("layer_show")}
                lockLabel={t("layer_lock")}
                unlockLabel={t("layer_unlock")}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
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
    // Toute la ligne se glisse (pas seulement la poignée ⋮⋮) : c'est le geste
    // attendu. Un simple clic sélectionne toujours (le glisser ne démarre
    // qu'après 4 px de mouvement, cf. activationConstraint).
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
