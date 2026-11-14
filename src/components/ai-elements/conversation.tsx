"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Fil de discussion (pattern « Chat » d'AI Elements) : zone défilante qui suit
 * le dernier message — sauf si l'utilisateur est remonté lire l'historique.
 * `scrollKey` change à chaque nouveau message / changement d'état.
 */
export function Conversation({
  className,
  children,
  scrollKey,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { scrollKey?: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stick.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [scrollKey]);

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
      }}
      className={cn("min-h-0 flex-1 overflow-y-auto overflow-x-hidden no-scrollbar", className)}
      {...props}
    >
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </div>
  );
}

/** État vide du fil : icône, titre, description et suggestions. */
export function ConversationEmptyState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-2 pt-8 pb-2 text-center", className)}>
      {icon && (
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}
