"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/motion";

interface ATSEmptyStateProps {
  onStart: () => void;
}

const FEATURES = [1, 2, 3] as const;

export function ATSEmptyState({ onStart }: ATSEmptyStateProps) {
  const t = useTranslations("ATS");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <Reveal className="flex flex-col items-center gap-3">
        <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground text-balance">{t("empty_title")}</h2>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-balance">{t("empty_subtitle")}</p>
      </Reveal>

      {/* CTA seul : le contexte du CV vit dans le badge d'en-tête. */}
      <Reveal index={1}>
        <Button size="lg" className="px-6" onClick={onStart}>
          {t("empty_cta")}
        </Button>
      </Reveal>

      <Reveal
        index={2}
        className="grid w-full grid-cols-1 divide-y divide-border rounded-xl border border-border bg-card text-left sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {FEATURES.map((n) => (
          <div key={n} className="flex flex-col gap-1.5 p-5">
            <span className="font-serif text-sm font-bold tabular-nums text-primary">{n}</span>
            <span className="text-sm font-semibold text-foreground">{t(`empty_feature${n}_title`)}</span>
            <p className="text-xs leading-relaxed text-muted-foreground">{t(`empty_feature${n}_desc`)}</p>
          </div>
        ))}
      </Reveal>
    </div>
  );
}
