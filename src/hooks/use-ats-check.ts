"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ATSReport, AIProvider, CVData } from "@/types/cv";
import type { ProviderFailure } from "@/lib/ai-orchestrator";

export type ATSStatus = "idle" | "loading" | "success" | "error";

interface RunArgs {
  cvData: CVData;
  jobDescription: string;
  provider?: AIProvider;
  model?: string;
  /** Clé API du provider sélectionné (BYOK). */
  apiKey?: string;
}

interface ATSErrorBody {
  error?: string;
  details?: string | string[];
  failures?: ProviderFailure[];
}

export interface UseATSCheck {
  status: ATSStatus;
  report: ATSReport | null;
  provider: AIProvider | null;
  errorMessage: string | null;
  errorDetails: string | string[] | null;
  /** Liste détaillée des providers qui ont échoué (clé manquante, quota, …). */
  errorFailures: ProviderFailure[] | null;
  /** Offre utilisée pour l'audit affiché — sert au flux d'adaptation depuis l'ATS. */
  lastJobDescription: string;
  run: (args: RunArgs) => Promise<{ success: boolean; report?: ATSReport }>;
  /** Annule l'audit ATS en cours (comme les autres actions IA). */
  cancel: () => void;
  reset: () => void;
}

/**
 * Lance un audit ATS du CV face à une offre d'emploi.
 * Le model est OPTIONNEL — l'API retombe automatiquement sur les autres modèles
 * OpenRouter (gpt-oss-120b → Hermes 3 405B → …) côté serveur via `callWithFallback`.
 */
export function useATSCheck(): UseATSCheck {
  const [status, setStatus] = useState<ATSStatus>("idle");
  const [report, setReport] = useState<ATSReport | null>(null);
  const [provider, setProvider] = useState<AIProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | string[] | null>(null);
  const [errorFailures, setErrorFailures] = useState<ProviderFailure[] | null>(null);
  const [lastJobDescription, setLastJobDescription] = useState("");
  const tErr = useTranslations("AIErrors");
  // Contrôleur d'annulation de l'audit en cours (l'audit ne pouvait pas être annulé).
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async ({ cvData, jobDescription, provider: prov, model, apiKey }: RunArgs) => {
    const trimmed = jobDescription.trim();
    if (trimmed.length < 20) {
      setStatus("error");
      setErrorMessage("Job description too short (min 20 chars).");
      setErrorDetails(null);
      setErrorFailures(null);
      return { success: false };
    }
    if (!apiKey || !apiKey.trim()) {
      setStatus("error");
      setErrorMessage(tErr("missing_key"));
      setErrorDetails(null);
      setErrorFailures(null);
      toast.error(tErr("missing_key"));
      return { success: false };
    }

    setStatus("loading");
    setReport(null);
    setProvider(null);
    setErrorMessage(null);
    setErrorDetails(null);
    setErrorFailures(null);
    setLastJobDescription(trimmed);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/ats-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: trimmed,
          cvData,
          provider: prov,
          model,
          apiKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = (await res.json()) as ATSErrorBody;
        throw errData;
      }
      const data = (await res.json()) as { report: ATSReport; provider: AIProvider };
      setReport(data.report);
      setProvider(data.provider);
      setStatus("success");
      return { success: true, report: data.report };
    } catch (err) {
      // Annulation utilisateur : retour à l'état initial, pas d'erreur affichée.
      const aborted = err instanceof DOMException ? err.name === "AbortError" : (err as { name?: string })?.name === "AbortError";
      if (aborted) {
        setStatus("idle");
        return { success: false };
      }
      const e = err as ATSErrorBody & { message?: string };
      setErrorMessage(e.error ?? e.message ?? "Unexpected error during ATS check.");
      setErrorDetails(e.details ?? null);
      setErrorFailures(e.failures ?? null);
      setStatus("error");
      const reason = e.failures?.[0]?.reason;
      toast.error(reason ? tErr(reason) : (e.error ?? "Unexpected error during ATS check."));
      return { success: false };
    } finally {
      abortRef.current = null;
    }
  }, [tErr]);

  const reset = useCallback(() => {
    setStatus("idle");
    setReport(null);
    setProvider(null);
    setErrorMessage(null);
    setErrorDetails(null);
    setErrorFailures(null);
  }, []);

  return {
    status,
    report,
    provider,
    errorMessage,
    errorDetails,
    errorFailures,
    lastJobDescription,
    run,
    cancel,
    reset,
  };
}
