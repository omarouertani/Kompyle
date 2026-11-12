"use client";

import { useState } from "react";
import { SKILL_LEVEL_MAX } from "@/lib/skill-levels";

interface SkillLevelBarProps {
  /** Remplissage affiché (0-1). */
  fill: number;
  /** Niveau choisi (1-5), ou undefined si aucun (remplissage par défaut). */
  level: number | undefined;
  color: string;
  label: string;
  onChange: (level: number) => void;
}

/**
 * Barre de niveau d'une compétence, réglable : clic à la position voulue
 * (5 crans), aperçu au survol, flèches du clavier. C'est un <button> : le
 * canvas n'entame pas de déplacement de bloc depuis un bouton.
 */
export function SkillLevelBar({ fill, level, color, label, onChange }: SkillLevelBarProps) {
  const [hover, setHover] = useState<number | null>(null);
  const current = level ?? Math.round(fill * SKILL_LEVEL_MAX);
  const levelAt = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    return Math.min(SKILL_LEVEL_MAX, Math.max(1, Math.ceil(ratio * SKILL_LEVEL_MAX)));
  };
  const shown = hover !== null ? hover / SKILL_LEVEL_MAX : fill;

  return (
    <button
      type="button"
      role="slider"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={SKILL_LEVEL_MAX}
      aria-valuenow={current}
      title={`${label} : ${hover ?? current}/${SKILL_LEVEL_MAX}`}
      onMouseMove={(e) => setHover(levelAt(e))}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onChange(levelAt(e));
      }}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (e.key === "Home") onChange(1);
        else if (e.key === "End") onChange(SKILL_LEVEL_MAX);
        else if (step) onChange(Math.min(SKILL_LEVEL_MAX, Math.max(1, current + step)));
        else return;
        e.preventDefault();
        e.stopPropagation();
      }}
      className="group/level relative w-12 shrink-0 cursor-pointer py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-sm"
      style={{ ["--tw-ring-color" as string]: color }}
    >
      <span className="block h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: `${color}26` }}>
        <span className="block h-full rounded-full transition-[width] duration-100" style={{ width: `${shown * 100}%`, backgroundColor: color }} />
      </span>
      {/* Crans, visibles seulement au survol / focus (jamais dans le PDF). */}
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover/level:opacity-100 group-focus-visible/level:opacity-100">
        {Array.from({ length: SKILL_LEVEL_MAX - 1 }, (_, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-[5px] w-px -translate-y-1/2 bg-white"
            style={{ left: `${((i + 1) / SKILL_LEVEL_MAX) * 100}%` }}
          />
        ))}
      </span>
    </button>
  );
}
