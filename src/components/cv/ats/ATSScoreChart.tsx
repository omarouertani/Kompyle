"use client";

import { useCountUp } from "@/components/ui/motion";
import { cssVarForScore } from "./ats-utils";

interface ATSScoreChartProps {
  /** Score 0-100. */
  score: number;
  /** Diamètre extérieur en px. */
  size?: number;
}

/**
 * Jauge radiale du score global (SVG natif). Le nombre monte vers sa valeur via
 * `useCountUp` et l'arc le suit ; avec `prefers-reduced-motion`, tout est posé
 * directement à la valeur finale.
 */
export function ATSScoreChart({ score, size = 168 }: ATSScoreChartProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const value = useCountUp(clamped);
  const color = cssVarForScore(clamped);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc ouvert vers le bas (80 % du cercle), façon jauge.
  const visible = circumference * 0.8;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped} / 100`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-[126deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${visible} ${circumference}`}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${visible} ${circumference}`}
          strokeDashoffset={visible - (value / 100) * visible}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="font-serif text-5xl font-bold leading-none tabular-nums text-foreground">{value}</span>
        <span className="mt-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
