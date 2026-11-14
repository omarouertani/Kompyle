import React from "react";
import { cn } from "@/lib/utils";

/** Texte « en cours » animé d'un reflet (utilitaire shimmer d'AI Elements).
 *  L'animation est coupée si l'utilisateur préfère moins de mouvement. */
export function Shimmer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block bg-[linear-gradient(90deg,var(--muted-foreground)_0%,var(--muted-foreground)_40%,var(--foreground)_50%,var(--muted-foreground)_60%,var(--muted-foreground)_100%)] bg-[length:250%_100%] bg-clip-text text-transparent motion-safe:animate-[ai-shimmer_2s_linear_infinite] motion-reduce:text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
