"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Sparkles, Loader2, Wand2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ModelSelect } from "@/components/ai/ModelSelect";
import { providerForModel, DEFAULT_MODEL } from "@/hooks/use-ai-provider-config";
import { useApiKeys } from "@/hooks/use-api-keys";
import { ApiKeysDialog } from "@/components/ApiKeysDialog";
import type { ATSReport, AIProvider, CVData } from "@/types/cv";
import type { ProviderFailure } from "@/lib/ai-orchestrator";
import { ATSAIError } from "./ATSAIError";

interface ATSAdaptPanelProps {
  cvData: CVData;
  jobDescription: string;
  report: ATSReport;
  /** Appelé avec le CV raffiné — le parent doit le poser dans le state (auto-save). */
  onApplied: (refinedCV: CVData) => void;
  /** Remonte l'état « adaptation en cours » pour piloter l'overlay de progression. */
  onAdaptingChange?: (adapting: boolean) => void;
}

type AdaptStatus = "idle" | "loading" | "success" | "error";

interface RefineErrorBody {
  error?: string;
  details?: string | string[];
  failures?: ProviderFailure[];
}

/**
 * Bloc d'action « Adapter le CV avec ces recommandations » — affiché APRÈS un
 * audit ATS réussi. Réutilise /api/refine-cv (édition surgicale, mêmes garde-fous
 * que le bouton « Modifier le CV » du sidebar) en injectant les reco ATS dans
 * l'instruction, plus une zone libre optionnelle pour des consignes additionnelles.
 *
 * Le CV sélectionné est REMPLACÉ via `onApplied()` ; côté parent, le `setCurrentCV`
 * du profile-manager déclenche l'auto-save sur la même ligne DB (pas de nouvelle
 * version créée).
 */
export function ATSAdaptPanel({ cvData, jobDescription, report, onApplied, onAdaptingChange }: ATSAdaptPanelProps) {
  const t = useTranslations("ATS");
  const tAdapt = useTranslations("AIAdapt");
  const tErr = useTranslations("AIErrors");
  const { keys } = useApiKeys();
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const provider: AIProvider = providerForModel(model);
  const apiKey = keys[provider];
  const [extra, setExtra] = useState("");
  const [status, setStatus] = useState<AdaptStatus>("idle");
  const [error, setError] = useState<{ msg: string | null; details: string | string[] | null; failures: ProviderFailure[] | null }>({ msg: null, details: null, failures: null });

  const buildInstruction = useCallback((userExtra: string) => {
    const recos = report.recommendations.length
      ? report.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")
      : "(no specific recommendations — improve overall ATS alignment with the posting)";
    const missing = report.missingKeywords.length
      ? report.missingKeywords.join(", ")
      : "(none reported)";

    const extraBlock = userExtra.trim()
      ? `\n\n## ADDITIONAL USER INSTRUCTIONS (apply on top)\n${userExtra.trim()}`
      : "";

    return `Apply these ATS-improvement actions to the CV. Stay TRUTHFUL — never invent skills or experiences that aren't already implied by existing content; if a recommendation requires inventing something, soften it to the closest truthful rewording instead.

## ATS RECOMMENDATIONS (apply in order)
${recos}

## KEYWORDS TO SURFACE (only when an existing entry truthfully entails them)
${missing}

Preserve every existing experience, project and skill item (no deletions); reframe wording and ordering only.${extraBlock}`;
  }, [report]);

  const submit = useCallback(async () => {
    if (!apiKey || !apiKey.trim()) {
      setError({ msg: tErr("missing_key"), details: null, failures: null });
      setStatus("error");
      toast.error(tErr("missing_key"));
      return;
    }
    setStatus("loading");
    onAdaptingChange?.(true);
    setError({ msg: null, details: null, failures: null });
    try {
      const res = await fetch("/api/refine-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: buildInstruction(extra),
          cvData,
          jobDescription: jobDescription || undefined,
          provider,
          model,
          apiKey,
        }),
      });
      if (!res.ok) {
        const errData = (await res.json()) as RefineErrorBody;
        setError({ msg: errData.error ?? null, details: errData.details ?? null, failures: errData.failures ?? null });
        setStatus("error");
        onAdaptingChange?.(false);
        return;
      }
      const data = (await res.json()) as { refinedCV: CVData };
      setStatus("success");
      setExtra("");
      onAdaptingChange?.(false);
      toast.success(tAdapt("toast_ats_adapt_success"));
      // Applique le CV adapté ET ouvre directement son aperçu (côté parent).
      onApplied(data.refinedCV);
    } catch (err) {
      const e = err as { message?: string };
      setError({ msg: e.message ?? "Network error", details: null, failures: null });
      setStatus("error");
      onAdaptingChange?.(false);
    }
  }, [extra, cvData, jobDescription, provider, model, apiKey, onApplied, onAdaptingChange, tAdapt, tErr, buildInstruction]);

  if (status === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-2">
        <ATSAIError
          message={error.msg}
          details={error.details}
          failures={error.failures}
          onRetry={() => { setStatus("idle"); setError({ msg: null, details: null, failures: null }); }}
        />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full flex items-center justify-center" style={{ color: "var(--ats-excellent)", backgroundColor: "color-mix(in oklab, var(--ats-excellent) 12%, transparent)" }}>
            <CheckCircle2 size={18} />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground">{t("adapt_success_title")}</span>
            <span className="text-xs text-muted-foreground">{t("adapt_success_hint")}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 px-3 text-xs gap-1.5" onClick={() => setStatus("idle")}>
          <Wand2 size={13} />
          {t("adapt_again")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-5">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-lg bg-primary/15 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
          <Wand2 size={16} className="text-primary" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground">{t("adapt_title")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("adapt_subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("adapt_extra_label")}
          </span>
          <Textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t("adapt_extra_placeholder")}
            className="min-h-[88px] resize-y text-sm leading-relaxed"
            disabled={status === "loading"}
          />
          <span className="text-[10px] text-muted-foreground">{t("adapt_extra_hint")}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <ModelSelect
            model={model}
            onModelChange={setModel}
            disabled={status === "loading"}
            label={t("adapt_model_label")}
          />
          <ApiKeysDialog className="w-full justify-center" />
          {!apiKey && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">{tErr("missing_key")}</span>
          )}
          <Button
            size="lg"
            onClick={submit}
            disabled={status === "loading"}
            className="w-full h-12 gap-2 text-sm font-semibold shadow-md shadow-primary/25 bg-gradient-to-b from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/30 transition-all mt-1"
          >
            {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {status === "loading" ? t("adapt_running") : t("adapt_cta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
