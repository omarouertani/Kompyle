"use client";

import { useState, useCallback, useEffect } from "react";
import type { CVData, CoverLetterData } from "@/types/cv";
import { defaultLayout } from "@/lib/cv-layout";
import { v4 as uuidv4 } from "uuid";
import cvDataEnRaw from "@/data/cv_data_en.json";
import cvDataFrRaw from "@/data/cv_data_fr.json";
import cvDataChaimaEnRaw from "@/data/cv_data_chaima_en.json";
import cvDataChaimaFrRaw from "@/data/cv_data_chaima_fr.json";

const injectIds = (data: any): CVData => ({
  ...data,
  skills: data.skills.map((s: any) => ({ ...s, id: s.id || uuidv4() })),
  experiences: data.experiences.map((e: any) => ({ ...e, id: e.id || uuidv4() })),
  projects: (data.projects || []).map((p: any) => ({ ...p, id: p.id || uuidv4() })),
  education: data.education.map((ed: any) => ({ ...ed, id: ed.id || uuidv4() })),
  layout: data.layout ?? defaultLayout(),
});

const initialDataEn = injectIds(cvDataEnRaw);
const initialDataFr = injectIds(cvDataFrRaw);
const initialDataChaimaEn = injectIds(cvDataChaimaEnRaw);
const initialDataChaimaFr = injectIds(cvDataChaimaFrRaw);

export type Status = "idle" | "loading" | "success" | "error";

export function useProfileManager(locale: string, t: (key: string, values?: Record<string, string>) => string) {
  const [selectedProfile, setSelectedProfile] = useState<"omar" | "chaima">("omar");
  const [selectedTemplate, setSelectedTemplate] = useState<"default" | "chaima">("default");

  const getInitialCV = useCallback((profile: "omar" | "chaima", lang: string) => {
    if (profile === "omar") {
      return lang === "fr" ? initialDataFr : initialDataEn;
    } else {
      return lang === "fr" ? initialDataChaimaFr : initialDataChaimaEn;
    }
  }, []);

  const [currentCV, setCurrentCV] = useState<CVData>(() => getInitialCV("omar", locale));
  const [originalCV, setOriginalCV] = useState<CVData | null>(null);
  const [isAdapted, setIsAdapted] = useState(false);
  const [coverLetterData, setCoverLetterData] = useState<CoverLetterData | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusDetails, setStatusDetails] = useState<string | string[] | null>(null);
  const [loadingType, setLoadingType] = useState<"cv" | "letter" | null>(null);

  useEffect(() => {
    const pending = sessionStorage.getItem("pending_adapted_cv");
    if (pending) {
      try {
        const { adaptedCV, originalCV: origCV, jobDescription: _savedJobDesc, profile } = JSON.parse(pending);
        setCurrentCV(adaptedCV);
        setOriginalCV(origCV);
        setIsAdapted(true);
        setSelectedProfile(profile);
        setSelectedTemplate(profile === "omar" ? "default" : "chaima");
        setStatus("success");
        setStatusMessage(t("status_success_cv", { provider: "Gemini" }));
        setStatusDetails(null);
      } catch (e) {
        console.error("Failed to parse pending adapted CV", e);
      } finally {
        sessionStorage.removeItem("pending_adapted_cv");
      }
      return;
    }

    const data = getInitialCV(selectedProfile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setStatus("idle");
    setStatusMessage("");
    setStatusDetails(null);
  }, [selectedProfile, locale, getInitialCV, t]);

  const handleProfileChange = useCallback((profile: "omar" | "chaima") => {
    setSelectedProfile(profile);
    const data = getInitialCV(profile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setCoverLetterData(null);
    setStatus("idle");
    setStatusMessage("");
    setStatusDetails(null);
    setSelectedTemplate(profile === "omar" ? "default" : "chaima");
  }, [locale, getInitialCV]);

  const handleReset = useCallback(() => {
    const data = getInitialCV(selectedProfile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setCoverLetterData(null);
    setStatus("idle");
    setStatusMessage("");
    setStatusDetails(null);
  }, [selectedProfile, locale, getInitialCV]);

  return {
    selectedProfile, selectedTemplate, setSelectedTemplate,
    currentCV, setCurrentCV, originalCV, setOriginalCV,
    isAdapted, setIsAdapted,
    coverLetterData, setCoverLetterData,
    status, setStatus, statusMessage, setStatusMessage,
    statusDetails, setStatusDetails, loadingType, setLoadingType,
    getInitialCV, handleProfileChange, handleReset,
  };
}
