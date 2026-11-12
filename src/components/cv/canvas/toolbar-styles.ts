import { cn } from "@/lib/utils";

/** Pastille de la barre du canvas qui ouvre un panneau (Thème, Insérer, Calques). */
export function toolbarPill(active: boolean): string {
  return cn(
    "flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[10px] font-semibold shadow-sm transition-colors",
    active ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted/80",
  );
}
