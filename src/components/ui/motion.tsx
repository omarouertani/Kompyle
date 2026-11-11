"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Petit système d'animations partagé. Les classes vivent dans `globals.css`
 * (section « Motion ») ; ces composants en sont la porte d'entrée pour ne plus
 * recopier `animate-*` au cas par cas :
 *
 *   <Spinner />            indicateur d'attente unique de l'app
 *   <Reveal index={n} />   apparition (fondu + légère montée), en cascade via `index`
 *   useCountUp(value)      nombre qui monte vers sa valeur (scores)
 *   usePrefersReducedMotion()
 *
 * `prefers-reduced-motion` : les classes sont neutralisées globalement en CSS et
 * `useCountUp` renvoie directement la valeur finale.
 */

export function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  /** Côté en px (défaut : 16). */
  size?: number;
}

/** Anneau de chargement : un arc qui tourne sur une piste discrète. */
export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn("motion-spin shrink-0", className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rang dans une cascade : chaque rang retarde l'apparition de 50 ms. */
  index?: number;
}

/** Apparition d'un bloc : fondu + légère montée. */
export function Reveal({ index = 0, className, style, ...props }: RevealProps) {
  return (
    <div
      className={cn("motion-enter", className)}
      style={{ ...style, "--i": index } as React.CSSProperties}
      {...props}
    />
  );
}

/** Fait monter un nombre de 0 vers `target` (easeOutCubic). */
export function useCountUp(target: number, duration = 800): number {
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return reduced ? target : value;
}
