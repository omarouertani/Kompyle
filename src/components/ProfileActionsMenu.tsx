"use client";

import { useEffect, useRef, useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileActionsMenuProps {
  onRename: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
  menuLabel: string;
}

/**
 * Menu ⋮ regroupant Renommer / Supprimer le profil actif. Remplace les deux
 * icônes inline pour alléger le bruit visuel de la zone profils. Ferme au clic
 * extérieur et à Échap.
 */
export function ProfileActionsMenu({ onRename, onDelete, renameLabel, deleteLabel, menuLabel }: ProfileActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="xs"
        className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((o) => !o)}
        title={menuLabel}
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={13} />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-50 min-w-36 rounded-lg border border-border bg-popover p-1 shadow-lg ring-1 ring-foreground/5 animate-in fade-in zoom-in-95 duration-100"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onRename(); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            <Pencil size={13} />
            {renameLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={13} />
            {deleteLabel}
          </button>
        </div>
      )}
    </div>
  );
}
