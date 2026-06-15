"use client";

import { useTranslations } from "next-intl";
import { Lightbulb, Star } from "lucide-react";

interface ATSRecommendationsProps {
  recommendations: string[];
  strengths: string[];
}

export function ATSRecommendations({ recommendations, strengths }: ATSRecommendationsProps) {
  const t = useTranslations("ATS");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <List
        title={t("recommendations_title")}
        subtitle={t("recommendations_subtitle")}
        icon={<Lightbulb size={16} className="text-primary" />}
        items={recommendations}
        emptyLabel={t("recommendations_empty")}
        color="var(--ats-excellent)"
      />
      <List
        title={t("strengths_title")}
        subtitle={t("strengths_subtitle")}
        icon={<Star size={16} style={{ color: "var(--ats-good)" }} />}
        items={strengths}
        emptyLabel={t("strengths_empty")}
        color="var(--ats-good)"
      />
    </div>
  );
}

interface ListProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: string[];
  emptyLabel: string;
  /** CSS variable utilisée pour la puce numérotée. */
  color: string;
}

function List({ title, subtitle, icon, items, emptyLabel, color }: ListProps) {
  const numberStyle: React.CSSProperties = {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-base font-semibold text-foreground">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-sm italic text-muted-foreground py-6">{emptyLabel}</div>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
              <span
                className="shrink-0 inline-flex size-6 items-center justify-center rounded-full text-xs font-bold"
                style={numberStyle}
              >
                {i + 1}
              </span>
              <span className="text-foreground/90">{item}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
