"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

/**
 * PromptInput — champ de saisie type "chatbot" réutilisable.
 *
 * Bordure aux couleurs du thème (primary / orange), zone de texte qui grandit
 * automatiquement jusqu'à une hauteur max, et une barre d'actions où l'on place
 * des boutons icône-seule qui s'agrandissent au survol pour révéler leur libellé.
 *
 * Volontairement SANS pièces jointes / micro / upload : on suit la logique de
 * l'app (juste du texte). Composé de primitives génériques pour être réutilisé
 * ailleurs (ex: formulaire ATS) sans logique métier embarquée.
 */

export function PromptInput({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="prompt-input"
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-primary/50 bg-background shadow-sm transition-colors",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25",
        className,
      )}
      {...props}
    />
  );
}

export interface PromptInputTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Hauteur max (px) avant l'apparition du scroll. */
  maxHeight?: number;
  /** Hauteur min (px) à vide. */
  minHeight?: number;
}

export const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  PromptInputTextareaProps
>(({ className, maxHeight = 220, minHeight = 96, onChange, value, ...props }, ref) => {
  const innerRef = React.useRef<HTMLTextAreaElement>(null);
  React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const resize = React.useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight]);

  // Re-mesure quand la valeur change (saisie ou reset programmatique).
  React.useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={innerRef}
      rows={1}
      value={value}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      style={{ minHeight }}
      className={cn(
        "w-full resize-none bg-transparent px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = "PromptInputTextarea";

export function PromptInputToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="prompt-input-toolbar"
      className={cn("flex items-center justify-end gap-1.5 border-t border-primary/15 px-2 py-2", className)}
      {...props}
    />
  );
}

export interface PromptInputActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    Pick<VariantProps<typeof buttonVariants>, "variant"> {
  /** Icône affichée en permanence (passe un spinner pour l'état chargement). */
  icon: React.ReactNode;
  /** Libellé révélé au survol / focus. */
  label: string;
}

/**
 * Bouton d'action de la barre : icône seule, qui s'agrandit au survol (et au
 * focus clavier) pour afficher son libellé. Largeur automatique, animée.
 */
export const PromptInputAction = React.forwardRef<HTMLButtonElement, PromptInputActionProps>(
  ({ icon, label, variant = "default", className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      title={label}
      aria-label={label}
      className={cn(
        buttonVariants({ variant }),
        "group/pa h-9 justify-start gap-0 overflow-hidden px-0 transition-all duration-300 ease-out",
        className,
      )}
      {...props}
    >
      <span className="grid size-9 shrink-0 place-items-center">{icon}</span>
      <span
        className={cn(
          "max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold opacity-0 transition-all duration-300 ease-out",
          "group-hover/pa:max-w-[180px] group-hover/pa:pr-3.5 group-hover/pa:opacity-100",
          "group-focus-visible/pa:max-w-[180px] group-focus-visible/pa:pr-3.5 group-focus-visible/pa:opacity-100",
        )}
      >
        {label}
      </span>
    </button>
  ),
);
PromptInputAction.displayName = "PromptInputAction";
