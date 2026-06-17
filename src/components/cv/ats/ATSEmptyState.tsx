"use client";

import { useTranslations } from "next-intl";
import { Sparkles, ShieldCheck, Target, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ATSEmptyStateProps {
  onStart: () => void;
}

export function ATSEmptyState({ onStart }: ATSEmptyStateProps) {
  const t = useTranslations("ATS");

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-7 p-8 text-center">
      {/* Bloc bouclier : dégradé + glow de marque → effet « moteur IA ». */}
      <div className="relative">
        <div className="absolute inset-0 blur-3xl bg-primary/30 rounded-full" />
        <div className="relative size-20 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/50 ring-1 ring-primary/30 shadow-lg shadow-primary/30 flex items-center justify-center">
          <ShieldCheck size={34} className="text-primary-foreground" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("empty_title")}
        </h2>
        <p className="max-w-xl mx-auto text-base text-muted-foreground leading-relaxed text-balance">
          {t("empty_subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl">
        <Feature icon={<Target size={18} className="text-primary" />} title={t("empty_feature1_title")} desc={t("empty_feature1_desc")} />
        <Feature icon={<ListChecks size={18} className="text-primary" />} title={t("empty_feature2_title")} desc={t("empty_feature2_desc")} />
        <Feature icon={<Sparkles size={18} className="text-primary" />} title={t("empty_feature3_title")} desc={t("empty_feature3_desc")} />
      </div>

      {/* CTA seul : le contexte du CV vit dans le badge d'en-tête (plus de doublon). */}
      <Button
        onClick={onStart}
        size="lg"
        className="h-12 px-7 gap-2 text-sm font-semibold bg-gradient-to-b from-primary to-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
      >
        <Sparkles size={16} />
        {t("empty_cta")}
      </Button>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
      <div className="flex items-center gap-2.5">
        <span className="size-8 rounded-lg bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0 transition-colors group-hover:bg-primary/15">
          {icon}
        </span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}
