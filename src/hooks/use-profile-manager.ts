"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CVData, CoverLetterData } from "@/types/cv";
import { defaultLayout } from "@/lib/cv-layout";
import { v4 as uuidv4 } from "uuid";

import cvDataEnRaw from "@/data/cv_data_en.json";
import cvDataFrRaw from "@/data/cv_data_fr.json";
import cvDataChaimaEnRaw from "@/data/cv_data_chaima_en.json";
import cvDataChaimaFrRaw from "@/data/cv_data_chaima_fr.json";

const injectIds = (data: CVData): CVData => ({
  ...data,
  skills: data.skills.map((s) => ({ ...s, id: s.id || uuidv4() })),
  experiences: data.experiences.map((e) => ({ ...e, id: e.id || uuidv4() })),
  projects: (data.projects ?? []).map((p) => ({ ...p, id: p.id || uuidv4() })),
  education: data.education.map((ed) => ({ ...ed, id: ed.id || uuidv4() })),
  layout: data.layout ?? defaultLayout(),
});

const fallbackDataEn = injectIds(cvDataEnRaw as unknown as CVData);
const fallbackDataFr = injectIds(cvDataFrRaw as unknown as CVData);
const fallbackDataChaimaEn = injectIds(cvDataChaimaEnRaw as unknown as CVData);
const fallbackDataChaimaFr = injectIds(cvDataChaimaFrRaw as unknown as CVData);

export interface CVProfile {
  id: string;
  slug: string;
  name: string;
  locale: string;
  template: string;
  cv_data: CVData;
  is_adaptation: boolean;
  parent_id: string | null;
}

export type Status = "idle" | "loading" | "success" | "error";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

function getFallbackCV(profile: string, lang: string): CVData {
  if (profile === "chaima") {
    return lang === "fr" ? fallbackDataChaimaFr : fallbackDataChaimaEn;
  }
  return lang === "fr" ? fallbackDataFr : fallbackDataEn;
}

export function useProfileManager(locale: string, t: (key: string, values?: Record<string, string>) => string) {
  const [selectedProfile, setSelectedProfile] = useState<string>("omar");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default");
  const [allRows, setAllRows] = useState<CVProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  /** Ligne DB du profil principal (jamais une adaptation). */
  const [mainProfileId, setMainProfileId] = useState<string | null>(null);
  /** Ligne DB actuellement éditée (profil principal OU adaptation). */
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  const [currentCV, setCurrentCV] = useState<CVData>(() => getFallbackCV("omar", locale));
  const [originalCV, setOriginalCV] = useState<CVData | null>(null);
  const [isAdapted, setIsAdapted] = useState(false);
  const [coverLetterData, setCoverLetterData] = useState<CoverLetterData | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusDetails, setStatusDetails] = useState<string | string[] | null>(null);
  const [loadingType, setLoadingType] = useState<"cv" | "letter" | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");
  const isInitialLoad = useRef(true);

  /** Profils principaux (pour le sélecteur de profil). */
  const profiles = useMemo(() => allRows.filter((p) => !p.is_adaptation), [allRows]);

  /** Adaptations du profil principal sélectionné. */
  const versions = useMemo(
    () => allRows.filter((p) => p.is_adaptation && p.parent_id === mainProfileId),
    [allRows, mainProfileId]
  );

  const fetchProfiles = useCallback(async (): Promise<CVProfile[]> => {
    try {
      const res = await fetch(`/api/cv-profiles?locale=${locale}`);
      if (res.ok) {
        const data: CVProfile[] = await res.json();
        setAllRows(data);
        return data;
      }
    } catch {
      // DB indisponible — fallback statique
    }
    setAllRows([]);
    return [];
  }, [locale]);

  /** Charge un CV (ligne DB) dans l'éditeur sans déclencher l'auto-save. */
  const loadRow = useCallback((row: { cv_data: CVData; template: string; id: string }) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    isInitialLoad.current = true;
    const cv = injectIds(row.cv_data);
    setCurrentCV(cv);
    setSelectedTemplate(row.template);
    setCurrentProfileId(row.id);
    lastSavedRef.current = JSON.stringify(cv);
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
  }, []);

  const loadFallback = useCallback((profile: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    isInitialLoad.current = true;
    const fallback = getFallbackCV(profile, locale);
    setCurrentCV(fallback);
    setSelectedTemplate(profile === "omar" ? "default" : "chaima");
    setMainProfileId(null);
    setCurrentProfileId(null);
    lastSavedRef.current = JSON.stringify(fallback);
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
  }, [locale]);

  const resetStatus = useCallback(() => {
    setOriginalCV(null);
    setIsAdapted(false);
    setStatus("idle");
    setStatusMessage("");
    setStatusDetails(null);
  }, []);

  /** Charge le profil principal `slug` depuis l'API (fallback statique sinon). */
  const loadMainProfile = useCallback(
    async (slug: string) => {
      const rows = await fetchProfiles();
      const main = rows.find((r) => r.slug === slug && !r.is_adaptation);
      if (main) {
        setMainProfileId(main.id);
        loadRow(main);
      } else {
        loadFallback(slug);
      }
      resetStatus();
    },
    [fetchProfiles, loadRow, loadFallback, resetStatus]
  );

  const getInitialCV = useCallback(
    (profile: string, lang: string) => getFallbackCV(profile, lang),
    []
  );

  // Chargement initial (+ CV adapté en attente après bascule de langue)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // sort du corps synchrone de l'effet (évite les renders en cascade)
      await Promise.resolve();
      if (cancelled) return;

      const pending = sessionStorage.getItem("pending_adapted_cv");
      if (pending) {
        try {
          const { adaptedCV, originalCV: origCV, profile } = JSON.parse(pending);
          setCurrentCV(adaptedCV);
          setOriginalCV(origCV);
          setIsAdapted(true);
          setSelectedProfile(profile);
          const template = profile === "omar" ? "default" : "chaima";
          setSelectedTemplate(template);
          setStatus("success");
          setStatusMessage(t("status_success_cv", { provider: "Gemini" }));
          setStatusDetails(null);
          lastSavedRef.current = JSON.stringify(adaptedCV);

          // Persiste l'adaptation en DB (sinon elle n'existerait qu'en mémoire
          // et serait perdue au prochain rechargement / autre navigateur).
          try {
            const rows = await fetchProfiles();
            if (cancelled) return;
            const main = rows.find((r) => r.slug === profile && !r.is_adaptation);
            if (main) setMainProfileId(main.id);
            const stamp = new Date().toLocaleString("fr-FR", {
              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
            });
            const res = await fetch("/api/cv-profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                slug: `${profile}-adapt-${Date.now()}`,
                name: `Adaptation ${stamp}`,
                locale,
                template,
                cv_data: adaptedCV,
                is_adaptation: true,
                parent_id: main?.id ?? null,
              }),
            });
            if (res.ok && !cancelled) {
              const saved = await res.json();
              setCurrentProfileId(saved.id);
              await fetchProfiles();
            }
          } catch {
            // DB indisponible : l'adaptation reste éditable en mémoire
          }
        } catch (e) {
          console.error("Failed to parse pending adapted CV", e);
        } finally {
          sessionStorage.removeItem("pending_adapted_cv");
        }
        setProfilesLoading(false);
        return;
      }

      setProfilesLoading(true);
      await loadMainProfile(selectedProfile);
      if (!cancelled) setProfilesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile, locale]);

  const handleProfileChange = useCallback((profile: string) => {
    setSelectedProfile(profile);
    setCoverLetterData(null);
    // le useEffect [selectedProfile] recharge le profil principal
  }, []);

  /** Bascule entre CV principal et une adaptation (dropdown de versions). */
  const selectVersion = useCallback(
    (id: string) => {
      const row = allRows.find((r) => r.id === id);
      if (!row) return;
      loadRow(row);
      if (row.is_adaptation) {
        const main = allRows.find((r) => r.id === row.parent_id);
        setOriginalCV(main ? injectIds(main.cv_data) : null);
        setIsAdapted(true);
      } else {
        resetStatus();
      }
    },
    [allRows, loadRow, resetStatus]
  );

  /** L'adaptation IA est enregistrée comme COPIE liée au profil principal ;
   *  le CV original n'est jamais écrasé. */
  const applyAdaptation = useCallback(
    async (adaptedCV: CVData) => {
      const mainCV = currentCV;
      const stamp = new Date().toLocaleString("fr-FR", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
      });

      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      isInitialLoad.current = true;
      setCurrentCV(adaptedCV);
      setOriginalCV(mainCV);
      setIsAdapted(true);
      lastSavedRef.current = JSON.stringify(adaptedCV);

      try {
        const res = await fetch("/api/cv-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug: `${selectedProfile}-adapt-${Date.now()}`,
            name: `Adaptation ${stamp}`,
            locale,
            template: selectedTemplate,
            cv_data: adaptedCV,
            is_adaptation: true,
            parent_id: mainProfileId,
          }),
        });
        if (res.ok) {
          const saved = await res.json();
          setCurrentProfileId(saved.id);
          await fetchProfiles();
        }
      } catch {
        // DB indisponible : l'adaptation reste éditable en mémoire
        setCurrentProfileId(null);
      }
    },
    [currentCV, selectedProfile, selectedTemplate, locale, mainProfileId, fetchProfiles]
  );

  const handleReset = useCallback(() => {
    if (mainProfileId) {
      selectVersion(mainProfileId);
    } else {
      loadFallback(selectedProfile);
    }
    setCoverLetterData(null);
    resetStatus();
  }, [mainProfileId, selectVersion, loadFallback, selectedProfile, resetStatus]);

  const performSave = useCallback(
    async (cvData: CVData) => {
      const snapshot = JSON.stringify(cvData);
      if (snapshot === lastSavedRef.current) {
        setHasUnsavedChanges(false);
        return;
      }

      setSaveStatus("saving");
      try {
        if (!currentProfileId) {
          // Profil fallback (aucune ligne DB) : on la crée au premier save pour
          // que l'état visuel (canvas, layout…) persiste entre navigateurs.
          const res = await fetch("/api/cv-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug: selectedProfile,
              name: selectedProfile.charAt(0).toUpperCase() + selectedProfile.slice(1),
              locale,
              template: selectedTemplate,
              cv_data: cvData,
              is_adaptation: false,
              parent_id: null,
            }),
          });
          if (!res.ok) throw new Error("save failed");
          const saved = await res.json();
          setMainProfileId(saved.id);
          setCurrentProfileId(saved.id);
          await fetchProfiles();
        } else {
          const res = await fetch(`/api/cv-profiles/${currentProfileId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cv_data: cvData, template: selectedTemplate }),
          });
          if (!res.ok) throw new Error("save failed");
        }
        lastSavedRef.current = snapshot;
        setSaveStatus("saved");
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setSaveStatus("error");
      }
    },
    [currentProfileId, selectedTemplate, selectedProfile, locale, fetchProfiles]
  );

  const handleSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    performSave(currentCV);
  }, [currentCV, performSave]);

  // Auto-save (2s après la dernière modification).
  // PERF : pas de JSON.stringify ici — sérialiser un CV avec photo base64
  // (plusieurs Mo) à CHAQUE changement bloquait le thread principal pendant
  // l'édition canvas. La comparaison réelle a lieu dans performSave, une
  // seule fois après le debounce.
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      lastSavedRef.current = JSON.stringify(currentCV);
      return;
    }

    setHasUnsavedChanges(true);

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      performSave(currentCV);
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [currentCV, performSave]);

  // Flush de sécurité : sauvegarde l'état visuel si l'utilisateur quitte
  // l'app (fermeture d'onglet, navigation, app en arrière-plan).
  const flushRef = useRef({ cv: currentCV, id: currentProfileId, template: selectedTemplate });
  useEffect(() => {
    flushRef.current = { cv: currentCV, id: currentProfileId, template: selectedTemplate };
  }, [currentCV, currentProfileId, selectedTemplate]);

  useEffect(() => {
    const flush = () => {
      const { cv, id, template } = flushRef.current;
      if (!id) return;
      const snapshot = JSON.stringify(cv);
      if (snapshot === lastSavedRef.current) return;
      lastSavedRef.current = snapshot;
      fetch(`/api/cv-profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cv_data: cv, template }),
        keepalive: true,
      }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return {
    selectedProfile,
    selectedTemplate,
    setSelectedTemplate,
    currentCV,
    setCurrentCV,
    originalCV,
    setOriginalCV,
    isAdapted,
    setIsAdapted,
    coverLetterData,
    setCoverLetterData,
    status,
    setStatus,
    statusMessage,
    setStatusMessage,
    statusDetails,
    setStatusDetails,
    loadingType,
    setLoadingType,
    getInitialCV,
    handleProfileChange,
    handleReset,
    profiles,
    profilesLoading,
    versions,
    mainProfileId,
    currentProfileId,
    selectVersion,
    applyAdaptation,
    saveStatus,
    hasUnsavedChanges,
    handleSave,
  };
}
