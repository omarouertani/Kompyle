"use client";

import { useRef, useState } from "react";
import { useDismiss } from "@/hooks/use-dismiss";
import { FileUp, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileActionsMenuProps {
  onRename: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
  menuLabel: string;
  /** Entrée « Importer un CV » (optionnelle). */
  onImport?: () => void;
  importLabel?: string;
}

/**
 * Menu ⋮ regroupant Renommer / Supprimer le profil actif. Remplace les deux
 * icônes inline pour alléger le bruit visuel de la zone profils. Ferme au clic
 * extérieur et à Échap.
 */
export function ProfileActionsMenu({ onRename, onDelete, renameLabel, deleteLabel, menuLabel, onImport, importLabel }: ProfileActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Clic ailleurs ou Échap : fermeture.
  useDismiss(open, () => setOpen(false), ref);

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
          className="absolute right-0 top-7 z-50 min-w-36 popover-surface p-1.5 motion-pop"
        >
          {onImport && importLabel && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onImport(); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-primary/10"
            >
              <FileUp size={13} />
              {importLabel}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onRename(); }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-primary/10"
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
