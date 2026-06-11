"use client";

import { useCallback } from "react";
import type { CVData, AIProvider, CoverLetterData } from "@/types/cv";
import type { Status } from "./use-profile-manager";

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
  currentCV: CVData;
  locale: string;
  selectedProfile: string;
  getInitialCV: (profile: string, lang: string) => CVData;
  getProviderName: (p: AIProvider) => string;
  /** Enregistre l'adaptation comme copie liée au profil (l'original reste intact). */
  applyAdaptation: (cv: CVData) => Promise<void>;
  setCoverLetterData: (d: CoverLetterData | null) => void;
  setActiveRightTab: (tab: "cv" | "letter") => void;
  setStatus: (s: Status) => void;
  setStatusMessage: (m: string) => void;
  setStatusDetails: (d: string | string[] | null) => void;
  setLoadingType: (t: "cv" | "letter" | null) => void;
  t: (key: string, values?: Record<string, string>) => string;
}

export function useAISubmission(deps: UseAISubmissionDeps) {
  const {
    jobDescription, provider, model, currentCV, locale, selectedProfile,
    getInitialCV, getProviderName,
    applyAdaptation, setCoverLetterData,
    setActiveRightTab, setStatus, setStatusMessage, setStatusDetails, setLoadingType, t,
  } = deps;

  const handleAdaptCV = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      setStatusDetails(null);
      return;
    }
    setStatus("loading");
    setLoadingType("cv");
    setActiveRightTab("cv");
    setStatusMessage(t("status_loading_cv"));
    setStatusDetails(null);

    const jobLang = detectLanguage(jobDescription);
    const hasLangMismatch = jobLang !== locale;

    let sourceCV = currentCV;
    let originalSourceCV = currentCV;

    if (hasLangMismatch) {
      sourceCV = getInitialCV(selectedProfile, jobLang);
      originalSourceCV = sourceCV;
    }

    try {
      const res = await fetch("/api/adapt-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: sourceCV, provider, model }),
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
        }));
        window.location.href = `/${jobLang}`;
      } else {
        await applyAdaptation(data.adaptedCV);
        setActiveRightTab("cv");
        setStatus("success");
        setStatusMessage(t("status_success_cv", { provider: getProviderName(data.provider) }));
      }
    } catch (err) {
      setStatus("error");
      const e = err as { error?: string; message?: string; details?: string | string[] };
      setStatusMessage(e.error || e.message || t("status_error"));
      setStatusDetails(e.details || null);
    } finally {
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, currentCV, locale, selectedProfile, getInitialCV, t, setActiveRightTab, getProviderName, applyAdaptation, setStatus, setStatusMessage, setStatusDetails, setLoadingType]);

  const handleGenerateLetter = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      setStatusDetails(null);
      return;
    }
    setStatus("loading");
    setLoadingType("letter");
    setActiveRightTab("letter");
    setStatusMessage(t("status_loading_letter"));
    setStatusDetails(null);
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: currentCV, provider, model }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
      const data = await res.json();
      setCoverLetterData(data.coverLetter);
      setActiveRightTab("letter");
      setStatus("success");
      setStatusMessage(t("status_success_letter", { provider: getProviderName(data.provider) }));
    } catch (err) {
      setStatus("error");
      const e = err as { error?: string; message?: string; details?: string | string[] };
      setStatusMessage(e.error || e.message || t("status_error"));
      setStatusDetails(e.details || null);
    } finally {
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, currentCV, t, setActiveRightTab, getProviderName, setCoverLetterData, setStatus, setStatusMessage, setStatusDetails, setLoadingType]);

  return { handleAdaptCV, handleGenerateLetter };
}
