"use client";

import { useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { CVData, AIProvider, CoverLetterData } from "@/types/cv";
import { getModelName } from "@/lib/ai-models";
import type { ProviderFailure } from "@/lib/ai-orchestrator";
import type { Status } from "./use-profile-manager";

/** Corps d'erreur renvoyé par les routes IA. */
type AIErrorBody = { error?: string; message?: string; details?: string | string[]; failures?: ProviderFailure[] };

function detectLanguage(text: string): "fr" | "en" {
  const frenchWords = [" de ", " la ", " le ", " et ", " pour ", " dans ", " en ", " une ", " des ", " est ", " avec ", " plus ", " sur ", " par "];
  const englishWords = [" of ", " the ", " and ", " for ", " in ", " a ", " with ", " is ", " to ", " on ", " at ", " more ", " by "];

  let frCount = 0;
  let enCount = 0;

  const lowerText = text.toLowerCase();
  for (const word of frenchWords) {
    let pos = 0;
    while ((pos = lowerText.indexOf(word, pos)) !== -1) {
      frCount++;
      pos += word.length;
    }
  }
  for (const word of englishWords) {
    let pos = 0;
    while ((pos = lowerText.indexOf(word, pos)) !== -1) {
      enCount++;
      pos += word.length;
    }
  }

  return frCount >= enCount ? "fr" : "en";
}

interface UseAISubmissionDeps {
  jobDescription: string;
  provider: AIProvider;
  model: string;
  /** Clé API du provider sélectionné (BYOK). Vide → l'appel est bloqué avant le réseau. */
  apiKey: string | undefined;
  currentCV: CVData;
  coverLetterData: CoverLetterData | null;
  locale: string;
  selectedProfile: string;
  selectedTemplate: string;
  /** Enregistre l'adaptation comme copie liée au profil (l'original reste intact). */
  applyAdaptation: (cv: CVData) => Promise<void>;
  /** Applique une modification IA au CV courant (même version, auto-save sur la même ligne DB). */
  setCurrentCV: (cv: CVData) => void;
  setCoverLetterData: (d: CoverLetterData | null) => void;
  setActiveRightTab: (tab: "cv" | "letter") => void;
  setStatus: (s: Status) => void;
  setStatusMessage: (m: string) => void;
  setStatusDetails: (d: string | string[] | null) => void;
  setLoadingType: (t: "cv" | "letter" | null) => void;
  t: (key: string, values?: Record<string, string>) => string;
  /** Traductions du namespace AIAdapt (libellés de toasts de succès). */
  tAdapt: (key: string, values?: Record<string, string>) => string;
}

export function useAISubmission(deps: UseAISubmissionDeps) {
  const {
    jobDescription, provider, model, apiKey, currentCV, coverLetterData, locale, selectedProfile, selectedTemplate,
    applyAdaptation, setCurrentCV, setCoverLetterData,
    setActiveRightTab, setStatus, setStatusMessage, setStatusDetails, setLoadingType, t, tAdapt,
  } = deps;

  const tErr = useTranslations("AIErrors");

  // Contrôleur d'annulation de la requête IA en cours. `cancel()` l'avorte ;
  // chaque handler en crée un neuf et le pose ici avant son fetch.
  const abortRef = useRef<AbortController | null>(null);

  /** Annule l'opération IA en cours (adaptation, lettre, modification). */
  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Vrai si l'erreur provient d'une annulation utilisateur (fetch aborté). */
  const isAbortError = (err: unknown): boolean =>
    err instanceof DOMException ? err.name === "AbortError" : (err as { name?: string })?.name === "AbortError";

  /** Toast d'erreur enrichi : on choisit le message selon la raison du 1er échec. */
  const showErrorToast = useCallback((e: AIErrorBody) => {
    const reason = e.failures?.[0]?.reason;
    toast.error(reason ? tErr(reason) : (e.error || e.message || t("status_error")));
  }, [tErr, t]);

  /** Garde BYOK : pas de clé pour ce provider → on bloque avant le réseau. */
  const ensureKey = useCallback((): boolean => {
    if (apiKey && apiKey.trim()) return true;
    setStatus("error");
    setStatusMessage(tErr("missing_key"));
    setStatusDetails(null);
    toast.error(tErr("missing_key"));
    return false;
  }, [apiKey, setStatus, setStatusMessage, setStatusDetails, tErr]);

  const handleAdaptCV = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      setStatusDetails(null);
      return;
    }
    if (!ensureKey()) return;
    setStatus("loading");
    setLoadingType("cv");
    setActiveRightTab("cv");
    setStatusMessage(t("status_loading_cv"));
    setStatusDetails(null);

    const jobLang = detectLanguage(jobDescription);
    const hasLangMismatch = jobLang !== locale;

    // Le CV source est toujours celui chargé (depuis la BD) ; plus de variante
    // codée en dur. En cas d'écart de langue, on bascule l'UI après adaptation.
    const sourceCV = currentCV;
    const originalSourceCV = currentCV;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/adapt-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: sourceCV, provider, model, apiKey }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
      const data = await res.json();

      if (hasLangMismatch) {
        sessionStorage.setItem("pending_adapted_cv", JSON.stringify({
          adaptedCV: data.adaptedCV,
          originalCV: originalSourceCV,
          jobDescription: jobDescription.trim(),
          profile: selectedProfile,
          template: selectedTemplate,
          model: data.model,
        }));
        window.location.href = `/${jobLang}`;
      } else {
        await applyAdaptation(data.adaptedCV);
        setActiveRightTab("cv");
        setStatus("success");
        setStatusMessage(t("status_success_cv", { provider: getModelName(data.model) }));
        toast.success(tAdapt("toast_cv_success"));
      }
    } catch (err) {
      if (isAbortError(err)) {
        setStatus("idle");
        setStatusMessage("");
        setStatusDetails(null);
      } else {
        setStatus("error");
        const e = err as AIErrorBody;
        setStatusMessage(e.error || e.message || t("status_error"));
        setStatusDetails(e.details || null);
        showErrorToast(e);
      }
    } finally {
      abortRef.current = null;
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, apiKey, currentCV, locale, selectedProfile, selectedTemplate, t, tAdapt, setActiveRightTab, applyAdaptation, setStatus, setStatusMessage, setStatusDetails, setLoadingType, ensureKey, showErrorToast]);

  const handleGenerateLetter = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      setStatusDetails(null);
      return;
    }
    if (!ensureKey()) return;
    setStatus("loading");
    setLoadingType("letter");
    setActiveRightTab("letter");
    setStatusMessage(t("status_loading_letter"));
    setStatusDetails(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: currentCV, provider, model, apiKey }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
      const data = await res.json();
      setCoverLetterData(data.coverLetter);
      setActiveRightTab("letter");
      setStatus("success");
      setStatusMessage(t("status_success_letter", { provider: getModelName(data.model) }));
      toast.success(tAdapt("toast_letter_success"));
    } catch (err) {
      if (isAbortError(err)) {
        setStatus("idle");
        setStatusMessage("");
        setStatusDetails(null);
      } else {
        setStatus("error");
        const e = err as AIErrorBody;
        setStatusMessage(e.error || e.message || t("status_error"));
        setStatusDetails(e.details || null);
        showErrorToast(e);
      }
    } finally {
      abortRef.current = null;
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, apiKey, currentCV, t, tAdapt, setActiveRightTab, setCoverLetterData, setStatus, setStatusMessage, setStatusDetails, setLoadingType, ensureKey, showErrorToast]);

  /** Modification ciblée du CV courant (même version — pas une nouvelle copie). */
  const handleRefineCV = useCallback(async (instruction: string): Promise<boolean> => {
    if (!instruction.trim() || instruction.trim().length < 3) {
      setStatus("error");
      setStatusMessage(t("error_refine_empty"));
      setStatusDetails(null);
      return false;
    }
    if (!ensureKey()) return false;
    setStatus("loading");
    setLoadingType("cv");
    setActiveRightTab("cv");
    setStatusMessage(t("status_loading_refine_cv"));
    setStatusDetails(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/refine-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instruction.trim(),
          cvData: currentCV,
          jobDescription: jobDescription.trim() || undefined,
          provider,
          model,
          apiKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
      const data = await res.json();
      // Même version : l'auto-save persiste sur la même ligne DB (pas de nouvelle copie)
      setCurrentCV(data.refinedCV);
      setStatus("success");
      setStatusMessage(t("status_success_refine", { provider: getModelName(data.model) }));
      toast.success(tAdapt("toast_refine_success"));
      return true;
    } catch (err) {
      if (isAbortError(err)) {
        setStatus("idle");
        setStatusMessage("");
        setStatusDetails(null);
        return false;
      }
      setStatus("error");
      const e = err as AIErrorBody;
      setStatusMessage(e.error || e.message || t("status_error"));
      setStatusDetails(e.details || null);
      showErrorToast(e);
      return false;
    } finally {
      abortRef.current = null;
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, apiKey, currentCV, t, tAdapt, setActiveRightTab, setCurrentCV, setStatus, setStatusMessage, setStatusDetails, setLoadingType, ensureKey, showErrorToast]);

  /** Modification ciblée de la lettre courante. */
  const handleRefineLetter = useCallback(async (instruction: string): Promise<boolean> => {
    if (!instruction.trim() || instruction.trim().length < 3) {
      setStatus("error");
      setStatusMessage(t("error_refine_empty"));
      setStatusDetails(null);
      return false;
    }
    if (!coverLetterData) return false;
    if (!ensureKey()) return false;
    setStatus("loading");
    setLoadingType("letter");
    setActiveRightTab("letter");
    setStatusMessage(t("status_loading_refine_letter"));
    setStatusDetails(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/refine-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instruction.trim(),
          coverLetter: coverLetterData,
          jobDescription: jobDescription.trim() || undefined,
          provider,
          model,
          apiKey,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
      const data = await res.json();
      setCoverLetterData(data.coverLetter);
      setStatus("success");
      setStatusMessage(t("status_success_refine", { provider: getModelName(data.model) }));
      toast.success(tAdapt("toast_refine_success"));
      return true;
    } catch (err) {
      if (isAbortError(err)) {
        setStatus("idle");
        setStatusMessage("");
        setStatusDetails(null);
        return false;
      }
      setStatus("error");
      const e = err as AIErrorBody;
      setStatusMessage(e.error || e.message || t("status_error"));
      setStatusDetails(e.details || null);
      showErrorToast(e);
      return false;
    } finally {
      abortRef.current = null;
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, apiKey, coverLetterData, t, tAdapt, setActiveRightTab, setCoverLetterData, setStatus, setStatusMessage, setStatusDetails, setLoadingType, ensureKey, showErrorToast]);

  return { handleAdaptCV, handleGenerateLetter, handleRefineCV, handleRefineLetter, cancel };
}
