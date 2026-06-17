"use client";

import { useTranslations } from "next-intl";
import { Check, AlertTriangle, XCircle } from "lucide-react";
import type { ATSSectionFeedback } from "@/types/cv";
import { Separator } from "@/components/ui/separator";
import { sectionStatusStyle } from "./ats-utils";

interface ATSSectionsProps {
  sections: ATSSectionFeedback[];
}

const STATUS_ICON = {
  good: <Check size={13} />,
  warning: <AlertTriangle size={13} />,
  missing: <XCircle size={13} />,
} as const;

export function ATSSections({ sections }: ATSSectionsProps) {
  const t = useTranslations("ATS");

  if (sections.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic p-6">
        {t("sections_empty")}
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card">
      {sections.map((s, idx) => (
        <div key={`${s.section}-${idx}`}>
          <div className="flex items-start gap-4 p-5">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide shrink-0"
              style={sectionStatusStyle(s.status)}
            >
              {STATUS_ICON[s.status]}
              {t(`status_${s.status}`)}
            </span>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="text-base font-semibold text-foreground">{s.section}</div>
              <div className="text-sm leading-relaxed text-muted-foreground">{s.feedback}</div>
            </div>
          </div>
          {idx < sections.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}
