"use client";

import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useTranslations } from "next-intl";
import { cssVarForScore } from "./ats-utils";
import type { ATSSubScores } from "@/types/cv";

interface ATSSubScoresProps {
  subScores: ATSSubScores;
}

interface Row {
  key: keyof ATSSubScores;
  labelKey: "sub_keywords" | "sub_skills" | "sub_experience" | "sub_formatting";
}

const ROWS: Row[] = [
  { key: "keywords", labelKey: "sub_keywords" },
  { key: "skills", labelKey: "sub_skills" },
  { key: "experience", labelKey: "sub_experience" },
  { key: "formatting", labelKey: "sub_formatting" },
];

export function ATSSubScoresPanel({ subScores }: ATSSubScoresProps) {
  const t = useTranslations("ATS");

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("subscores_title")}
      </div>
      <div className="flex flex-col gap-3.5">
        {ROWS.map((row, idx) => (
          <div key={row.key} className="flex flex-col gap-2">
            <ScoreRow value={subScores[row.key]} label={t(row.labelKey)} />
            {idx < ROWS.length - 1 && <Separator className="opacity-50" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreRow({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const color = cssVarForScore(clamped);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-base" style={{ color }}>{clamped}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
