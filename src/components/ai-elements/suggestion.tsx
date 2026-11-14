"use client";

import React from "react";
import { cn } from "@/lib/utils";

/** Liste de suggestions envoyables en un clic (pattern « Suggestion » d'AI Elements). */
export function Suggestions({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-wrap justify-center gap-1.5", className)}>{children}</div>;
}

export function Suggestion({
  icon,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
