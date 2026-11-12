"use client";

import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/motion";

export interface DownloadFormat {
  /** Identifiant stable (pdf, docx, txt). */
  id: string;
  /** Nom court du format, affiché tel quel (« PDF »). */
  label: string;
  /** À quoi sert ce format, en une ligne. */
  description?: string;
  onSelect: () => void;
  /** Génération en cours pour ce format. */
  busy?: boolean;
}

interface DownloadMenuProps {
  /** Libellé du bouton (« Télécharger »). */
  label: string;
  /** Libellé pendant une génération (« Génération… »). */
  busyLabel: string;
  formats: DownloadFormat[];
}

/**
 * Bouton de téléchargement unique de l'app. Plusieurs formats : bouton principal
 * + menu (le premier format est le format recommandé). Un seul format : bouton
 * simple, de même apparence.
 */
export function DownloadMenu({ label, busyLabel, formats }: DownloadMenuProps) {
  const busy = formats.some((f) => f.busy);
  const content = busy ? (
    <>
      <Spinner size={14} />
      {busyLabel}
    </>
  ) : (
    <>
      <Download />
      {label}
    </>
  );

  if (formats.length === 1) {
    return (
      <Button className="shrink-0 px-3.5" disabled={busy} onClick={formats[0].onSelect}>
        {content}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        render={
          <Button className="shrink-0 px-3.5">
            {content}
            {!busy && <ChevronDown className="opacity-70" />}
          </Button>
        }
      />
      <DropdownMenuContent className="w-72">
        {formats.map((f) => (
          <DropdownMenuItem key={f.id} onClick={f.onSelect} className="items-start">
            <span className="mt-px w-11 shrink-0 rounded bg-muted px-1 py-0.5 text-center text-[10px] font-bold tracking-wide text-foreground">
              {f.label}
            </span>
            {f.description && <span className="text-xs leading-snug text-muted-foreground">{f.description}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
