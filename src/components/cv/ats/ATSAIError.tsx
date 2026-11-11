"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ProviderFailure } from "@/lib/ai-orchestrator";
import { PROVIDER_META, getModelName, providerForModel } from "@/hooks/use-ai-provider-config";

interface ATSAIErrorProps {
  message: string | null;
  details: string | string[] | null;
  failures: ProviderFailure[] | null;
  onRetry: () => void;
}

export function ATSAIError({ message, details, failures, onRetry }: ATSAIErrorProps) {
  const t = useTranslations("ATS");

  const hasFailures = !!failures && failures.length > 0;
  const allMissingKey = hasFailures && failures!.every((f) => f.reason === "missing_key");

  // Conseil principal selon les raisons combinées.
  let hint: string;
  if (allMissingKey) hint = t("error_hint_missing_key");
  else if (hasFailures && failures!.some((f) => f.reason === "quota" || f.reason === "rate_limit"))
    hint = t("error_hint_quota");
  else if (hasFailures && failures!.every((f) => f.reason === "model_unavailable"))
    hint = t("error_hint_model_unavailable");
  else if (hasFailures && failures!.some((f) => f.reason === "auth"))
    hint = t("error_hint_auth");
  else if (hasFailures && failures!.some((f) => f.reason === "network" || f.reason === "timeout"))
    hint = t("error_hint_network");
  else hint = t("error_hint_generic");

  return (
    <div className="flex flex-col items-center justify-center gap-5 py-12 px-6 max-w-2xl mx-auto">
      <div className="size-16 rounded-full bg-destructive/10 ring-1 ring-destructive/30 flex items-center justify-center shrink-0">
        <AlertTriangle size={26} className="text-destructive" />
      </div>

      <div className="flex flex-col gap-2 text-center">
        <h3 className="text-lg font-semibold text-foreground">{t("error_title")}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <p className="text-sm text-foreground/90 leading-relaxed mt-1">{hint}</p>
      </div>

      {hasFailures && (
        <div className="w-full flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("error_providers_title")}
          </div>
          <Separator />
          <ul className="flex flex-col gap-2.5 mt-1">
            {failures!.map((f, i) => (
              <li key={`${f.model}-${i}`} className="flex items-start gap-3 text-sm">
                <span
                  className="size-2.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: PROVIDER_META[providerForModel(f.model)].color }}
                />
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-foreground">{getModelName(f.model)}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                      {t(`error_reason_${f.reason}` as const)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground break-words leading-relaxed">{f.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!hasFailures && details && (
        <div className="text-xs text-muted-foreground/80 break-words text-center">
          {Array.isArray(details) ? details.join(" · ") : details}
        </div>
      )}

      <Button variant="outline" onClick={onRetry}>
        <RotateCcw />
        {t("btn_retry")}
      </Button>
    </div>
  );
}
