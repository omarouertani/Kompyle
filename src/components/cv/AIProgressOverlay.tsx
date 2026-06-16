"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";

interface AIProgressOverlayProps {
  /** Pilote l'affichage : true tant que la requête IA est en vol. */
  active: boolean;
  /** Titre affiché dans la carte (ex. « L'IA travaille sur votre CV… »). */
  title?: string;
  /** Sous-titre / aide. */
  hint?: string;
}

/**
 * Overlay de progression IA partagé — floute l'arrière-plan, s'affiche au centre
 * et présente une barre de progression (shadcn `Progress`) au lieu d'une animation
 * décorative. Comme les endpoints renvoient un JSON unique (pas de streaming), la
 * barre « trickle » de façon monotone vers ~90 % pendant la requête RÉELLE puis
 * saute à 100 % dès que la réponse arrive — elle est donc rythmée par le cycle de
 * vie réel de la requête, sans pourcentage inventé.
 *
 * Le composant gère lui-même sa visibilité : on le rend en permanence avec
 * `active={isLoading}` et il s'occupe du fondu de sortie + du palier 100 %.
 */
export default function AIProgressOverlay({ active, title, hint }: AIProgressOverlayProps) {
  const t = useTranslations("AIAdapt");
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  // Tous les setState passent par des callbacks (rAF / timers) plutôt que par le
  // corps de l'effet : on évite les rendus en cascade signalés par le React Compiler.
  useEffect(() => {
    if (active) {
      startedRef.current = true;
      const raf = requestAnimationFrame(() => {
        setVisible(true);
        setValue((v) => (v < 10 ? 10 : v));
      });
      const id = setInterval(() => {
        setValue((v) => {
          if (v >= 90) return v;
          // Pas qui ralentit à l'approche de 90 % (effet "presque fini").
          const step = Math.max(0.6, (90 - v) * 0.07);
          return Math.min(90, v + step);
        });
      }, 220);
      return () => {
        cancelAnimationFrame(raf);
        clearInterval(id);
      };
    }

    // Inactif : si une requête était en cours, on finit à 100 % puis on masque.
    if (!startedRef.current) return;
    startedRef.current = false;
    const raf = requestAnimationFrame(() => setValue(100));
    const to = setTimeout(() => {
      setVisible(false);
      setValue(0);
    }, 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(to);
    };
  }, [active]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/40 dark:bg-black/45 backdrop-blur-[6px] p-6 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/95 shadow-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="size-5 text-primary animate-pulse" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground leading-tight">
              {title ?? t("adapting_cv")}
            </span>
            <span className="text-xs text-muted-foreground leading-snug">
              {hint ?? t("hint")}
            </span>
          </div>
        </div>

        <Field className="w-full">
          <FieldLabel htmlFor="ai-progress">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("progress_label")}
            </span>
            <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
              {Math.round(value)}%
            </span>
          </FieldLabel>
          <Progress value={value} id="ai-progress" />
        </Field>
      </div>
    </div>
  );
}
