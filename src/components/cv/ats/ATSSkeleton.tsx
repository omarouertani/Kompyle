"use client";

import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ATSSkeletonProps {
  providerHint?: string;
}

/**
 * Skeleton ATS — mime la mise en page finale (chart + sub-scores + 2 colonnes
 * mots-clés + sections + reco). Aide à percevoir le calcul comme déjà en cours.
 */
export function ATSSkeleton({ providerHint }: ATSSkeletonProps) {
  const t = useTranslations("ATS");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin text-primary" />
        <span>{t("loading_title")}</span>
        {providerHint && <span className="text-muted-foreground/70">— {providerHint}</span>}
      </div>

      {/* Bloc score (chart + sub-scores) */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8">
          <Skeleton className="size-[260px] rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3.5 w-10" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Mots-clés */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map((c) => (
          <div key={c} className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex justify-between"><Skeleton className="h-5 w-32" /><Skeleton className="h-3.5 w-14" /></div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="rounded-xl border border-border bg-card flex flex-col">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-start gap-4 p-5 border-b border-border last:border-0">
            <Skeleton className="h-6 w-20 rounded-md" />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
