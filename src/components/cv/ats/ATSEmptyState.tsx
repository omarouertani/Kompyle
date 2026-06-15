"use client";

import { useTranslations } from "next-intl";
import { Sparkles, ShieldCheck, Target, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ATSEmptyStateProps {
  cvName: string;
  onStart: () => void;
}

export function ATSEmptyState({ cvName, onStart }: ATSEmptyStateProps) {
  const t = useTranslations("ATS");

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-7 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 blur-3xl bg-primary/25 rounded-full" />
        <div className="relative size-20 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center">
          <ShieldCheck size={34} className="text-primary" />
        </div>
      </div>

      <div className="flex flex-col gap-2 max-w-xl">
        <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          {t("empty_title")}
        </h2>
        <p className="text-base text-muted-foreground leading-relaxed">
          {t("empty_subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
        <Feature icon={<Target size={18} className="text-primary" />} title={t("empty_feature1_title")} desc={t("empty_feature1_desc")} />
        <Feature icon={<ListChecks size={18} className="text-primary" />} title={t("empty_feature2_title")} desc={t("empty_feature2_desc")} />
        <Feature icon={<Sparkles size={18} className="text-primary" />} title={t("empty_feature3_title")} desc={t("empty_feature3_desc")} />
      </div>

      <div className="flex flex-col items-center gap-2.5">
        <Button onClick={onStart} size="lg" className="h-12 px-7 gap-2 text-sm font-semibold shadow-md shadow-primary/25 bg-gradient-to-b from-primary to-primary/90">
          <Sparkles size={16} />
          {t("empty_cta")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t("empty_selected_cv", { name: cvName })}
        </p>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
