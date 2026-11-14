"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type MessageRole = "user" | "assistant";

/** Un tour de conversation (pattern « Message » d'AI Elements). */
export function Message({ from, className, children }: { from: MessageRole; className?: string; children: React.ReactNode }) {
  return (
    <div
      data-from={from}
      className={cn("group/message flex w-full gap-2.5", from === "user" ? "justify-end" : "justify-start", className)}
    >
      {from === "assistant" && (
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
          <Sparkles size={13} />
        </div>
      )}
      <div className={cn("flex min-w-0 flex-col gap-1.5", from === "user" ? "max-w-[85%] items-end" : "max-w-[calc(100%-2.5rem)] items-start")}>
        {children}
      </div>
    </div>
  );
}

/** Corps du message : bulle pour l'utilisateur, texte libre pour l'assistant. */
export function MessageContent({
  from,
  tone = "default",
  className,
  children,
}: {
  from: MessageRole;
  tone?: "default" | "error";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed break-words",
        from === "user"
          ? "rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-primary-foreground shadow-sm"
          : "rounded-2xl rounded-tl-md border border-border/60 bg-card px-3.5 py-2.5 text-foreground shadow-sm",
        tone === "error" && "border-destructive/30 bg-destructive/5 text-destructive",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Actions rapides sous une réponse de l'assistant. */
export function MessageActions({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex flex-wrap gap-1.5", className)}>{children}</div>;
}

export function MessageAction({
  icon,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
