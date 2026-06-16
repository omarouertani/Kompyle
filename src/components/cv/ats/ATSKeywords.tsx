"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import type { ATSMatchedKeyword } from "@/types/cv";

interface ATSKeywordsProps {
  matched: ATSMatchedKeyword[];
  missing: string[];
}

export function ATSKeywords({ matched, missing }: ATSKeywordsProps) {
  const t = useTranslations("ATS");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <KeywordColumn
        title={t("matched_title")}
        subtitle={t("matched_subtitle", { count: String(matched.length) })}
        items={matched.map((kw) => ({ label: kw.term, hint: kw.foundInSection }))}
        icon={<Check size={12} />}
        tone="positive"
        emptyLabel={t("matched_empty")}
      />
      <KeywordColumn
        title={t("missing_title")}
        subtitle={t("missing_subtitle", { count: String(missing.length) })}
        items={missing.map((kw) => ({ label: kw }))}
        icon={<X size={12} />}
        tone="negative"
        emptyLabel={t("missing_empty")}
      />
    </div>
  );
}

interface KeywordChip {
  label: string;
  /** Preuve contextuelle (foundInSection) affichée au survol pour les mots-clés trouvés. */
  hint?: string;
}

interface ColumnProps {
  title: string;
  subtitle: string;
  items: KeywordChip[];
  icon: React.ReactNode;
  tone: "positive" | "negative";
  emptyLabel: string;
}

function KeywordColumn({ title, subtitle, items, icon, tone, emptyLabel }: ColumnProps) {
  const color = tone === "positive" ? "var(--ats-excellent)" : "var(--ats-poor)";
  const chipStyle: React.CSSProperties = {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 12%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 25%, transparent)`,
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 min-h-[220px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground italic">
          {emptyLabel}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((kw, i) => (
            <span
              key={`${kw.label}-${i}`}
              title={kw.hint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={chipStyle}
            >
              {icon}
              {kw.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
