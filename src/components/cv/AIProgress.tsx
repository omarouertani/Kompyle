"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

/** Les quatre traitements IA de l'app : chacun a son titre et ses étapes. */
export type AIProgressKind = "cv" | "letter" | "ats" | "ats_adapt";

const STEP_COUNT = 4;
/** Instant (en secondes) où chaque étape devient l'étape en cours. La dernière
 *  reste « en cours » jusqu'à la réponse réelle : on n'annonce jamais la fin
 *  avant qu'elle n'arrive. */
const STEP_STARTS = [0, 2.5, 7, 13];
const TITLE_KEY = {
  cv: "adapting_cv",
  letter: "adapting_letter",
  ats: "auditing_ats",
  ats_adapt: "adapting_ats",
} as const;

interface AIProgressState {
  /** Le composant doit être affiché (inclut le court palier « terminé »). */
  visible: boolean;
  /** Index de l'étape en cours ; `STEP_COUNT` quand tout est terminé. */
  step: number;
  /** Secondes écoulées depuis le début de la requête. */
  elapsed: number;
  /** Remplissage de la barre, 0 → 1. */
  fraction: number;
}

const IDLE: AIProgressState = { visible: false, step: 0, elapsed: 0, fraction: 0 };

/**
 * Suit le cycle de vie RÉEL d'une requête IA (les endpoints renvoient un JSON
 * unique, sans streaming) : les étapes avancent avec le temps écoulé, la barre
 * approche de la fin sans jamais l'atteindre, et tout se termine d'un coup quand
 * `active` repasse à false. Aucun pourcentage inventé n'est affiché.
 */
export function useAIProgress(active: boolean): AIProgressState {
  const [state, setState] = useState<AIProgressState>(IDLE);
  const startedRef = useRef(false);

  useEffect(() => {
    if (active) {
      startedRef.current = true;
      const start = performance.now();
      const tick = () => {
        const elapsed = (performance.now() - start) / 1000;
        let step = 0;
        for (let i = 0; i < STEP_STARTS.length; i++) if (elapsed >= STEP_STARTS[i]) step = i;
        // Courbe asymptotique : rapide au début, plafonnée à 92 %.
        const fraction = 0.04 + 0.88 * (1 - Math.exp(-elapsed / 9));
        setState({ visible: true, step, elapsed, fraction });
      };
      const raf = requestAnimationFrame(tick);
      const id = setInterval(tick, 250);
      return () => {
        cancelAnimationFrame(raf);
        clearInterval(id);
      };
    }

    // Fin de requête : toutes les étapes cochées, barre pleine, puis on masque.
    if (!startedRef.current) return;
    startedRef.current = false;
    const raf = requestAnimationFrame(() =>
      setState((s) => ({ ...s, step: STEP_COUNT, fraction: 1 })),
    );
    const to = setTimeout(() => setState(IDLE), 650);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(to);
    };
  }, [active]);

  return state;
}

function formatElapsed(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface AIProgressCardProps {
  kind: AIProgressKind;
  state: AIProgressState;
  /** Remplace le titre par défaut du traitement. */
  title?: string;
  /** Affiche un bouton « Annuler » dans l'en-tête. */
  onCancel?: () => void;
  className?: string;
}

/** Carte de progression : titre, temps écoulé, barre, liste d'étapes. */
export function AIProgressCard({ kind, state, title, onCancel, className }: AIProgressCardProps) {
  const t = useTranslations("AIAdapt");
  const steps = Array.from({ length: STEP_COUNT }, (_, i) => t(`steps_${kind}_${i + 1}` as "steps_cv_1"));

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "motion-pop flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-xl",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold leading-tight text-foreground">{title ?? t(TITLE_KEY[kind])}</span>
          <span className="text-xs leading-snug text-muted-foreground">{t("hint")}</span>
        </div>
        <span
          className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
          title={t("elapsed")}
        >
          {formatElapsed(state.elapsed)}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${state.fraction})` }}
        />
      </div>

      <ol className="flex flex-col gap-2.5">
        {steps.map((label, i) => {
          const done = i < state.step;
          const current = i === state.step;
          return (
            <li key={i} className="flex items-center gap-2.5 text-[13px] leading-tight" aria-current={current ? "step" : undefined}>
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                  done && "bg-primary text-primary-foreground",
                  current && "text-primary",
                  !done && !current && "border border-border",
                )}
              >
                {done && <Check size={10} strokeWidth={3} className="motion-pop" />}
                {current && <Spinner size={16} />}
              </span>
              <span
                className={cn(
                  "transition-colors duration-300",
                  current ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/60",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      {onCancel && (
        <Button variant="outline" size="sm" className="self-end" onClick={onCancel}>
          {t("cancel")}
        </Button>
      )}
    </div>
  );
}

interface AIProgressProps {
  /** true tant que la requête IA est en vol. */
  active: boolean;
  kind: AIProgressKind;
  title?: string;
  onCancel?: () => void;
  className?: string;
}

/** Progression IA posée dans le flux de la page (ex. audit ATS). */
export function AIProgressInline({ active, kind, title, onCancel, className }: AIProgressProps) {
  const state = useAIProgress(active);
  if (!state.visible) return null;
  return <AIProgressCard kind={kind} state={state} title={title} onCancel={onCancel} className={className} />;
}

/**
 * Progression IA en surimpression : voile + flou sur le conteneur parent
 * (`relative`), carte centrée. À rendre en permanence avec `active={isLoading}` :
 * le composant gère lui-même son apparition et son palier de fin.
 */
export function AIProgressOverlay({ active, kind, title, onCancel }: AIProgressProps) {
  const state = useAIProgress(active);
  if (!state.visible) return null;
  return (
    <div className="motion-fade absolute inset-0 z-40 flex items-center justify-center bg-background/50 p-6 backdrop-blur-[6px] select-none dark:bg-black/45">
      <AIProgressCard kind={kind} state={state} title={title} onCancel={onCancel} />
    </div>
  );
}
