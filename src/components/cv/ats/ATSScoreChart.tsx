"use client";

import { useEffect, useState } from "react";
import { cssVarForScore } from "./ats-utils";

interface ATSScoreChartProps {
  /** Score 0-100. */
  score: number;
  /** Libellé court (Excellent, Bon, …). */
  label: string;
  /** Texte secondaire (ex: "Score ATS"). */
  caption: string;
  /** Diamètre extérieur du chart en px. */
  size?: number;
}

/**
 * Chart radial animé (SVG natif, zéro dépendance Recharts).
 * À l'apparition, le score grimpe de 0 → valeur cible en ~900ms via easeOutCubic
 * et l'arc se remplit en synchronisé via stroke-dashoffset.
 */
export function ATSScoreChart({ score, label, caption, size = 280 }: ATSScoreChartProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const [displayValue, setDisplayValue] = useState(0);
  const color = cssVarForScore(clamped);

  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Arc visible ouvert vers le bas (≈ 80% du cercle) — laisse de l'air au libellé.
  const arcSpan = 0.8;
  const visibleCircumference = circumference * arcSpan;

  useEffect(() => {
    let rafId = 0;
    const start = performance.now();
    const duration = 900;
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplayValue(Math.round(eased * clamped));
      if (t < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [clamped]);

  const offset = visibleCircumference - (displayValue / 100) * visibleCircumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          // Rotation pour ouvrir l'arc en bas (style jauge).
          className="-rotate-[126deg]"
        >
          {/* Piste */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${visibleCircumference} ${circumference}`}
            className="text-muted/40"
          />
          {/* Progression */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${visibleCircumference} ${circumference}`}
            strokeDashoffset={offset}
            style={{
              filter: `drop-shadow(0 0 8px color-mix(in oklab, ${color} 45%, transparent))`,
              transition: "stroke 300ms ease",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-serif text-7xl font-bold tabular-nums leading-none" style={{ color }}>
            {displayValue}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">
            / 100
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="text-base font-semibold" style={{ color }}>{label}</div>
        <div className="text-sm text-muted-foreground">{caption}</div>
      </div>
    </div>
  );
}
