"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CVData, CoverLetterData } from "@/types/cv";
import { defaultLayout, emptyCV, normalizeTemplate, migrateLayoutForTemplate } from "@/lib/cv-layout";
import { getModelName, DEFAULT_MODEL } from "@/lib/ai-models";
import { v4 as uuidv4 } from "uuid";

const injectIds = (data: CVData): CVData => ({
  ...data,
  skills: data.skills.map((s) => ({ ...s, id: s.id || uuidv4() })),
  experiences: data.experiences.map((e) => ({ ...e, id: e.id || uuidv4() })),
  projects: (data.projects ?? []).map((p) => ({ ...p, id: p.id || uuidv4() })),
  education: data.education.map((ed) => ({ ...ed, id: ed.id || uuidv4() })),
  layout: data.layout ?? defaultLayout(),
});

export interface CVProfile {
  id: string;
  slug: string;
  name: string;
  locale: string;
  template: string;
  cv_data: CVData;
  cover_letter?: CoverLetterData | null;
  /** Snapshot du CV original au moment de l'adaptation (pour le diff côte à côte). */
  original_cv?: CVData | null;
  is_adaptation: boolean;
  parent_id: string | null;
}

export type Status = "idle" | "loading" | "success" | "error";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Plus de données codées en dur : les profils vivent en base. Si la BD est
 *  indisponible, on démarre sur un CV vierge (éditable / à reconstruire). */
function getFallbackCV(template: string): CVData {
  return injectIds(emptyCV(template));
}

/** Nom lisible d'une adaptation : titre du CV (rôle, sinon nom) + date courte —
 *  jamais un identifiant technique de base de données. Le titre reste COMPLET
 *  (pas de troncature à la source) : le dropdown le tronque visuellement et le
 *  révèle au survol via l'effet marquee. Format compact (`·`, mois court). */
function adaptationName(cv: CVData, locale: string): string {
  const title = cv.personalInfo?.role?.trim() || cv.personalInfo?.name?.trim() || "CV";
  const date = new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", {
    day: "2-digit",
    month: "short",
  });
  return `${title} · ${date}`;
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

  const [currentCV, setCurrentCV] = useState<CVData>(() => getFallbackCV("default"));
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

  // La lettre de motivation appartient au profil : on la persiste indépendamment
  // du CV (une édition de lettre seule doit aussi déclencher une sauvegarde).
  const coverLetterRef = useRef<CoverLetterData | null>(coverLetterData);
  const letterSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedLetterRef = useRef<string>("");
  const letterProfileRef = useRef<string | null>(null);
  useEffect(() => {
    coverLetterRef.current = coverLetterData;
  }, [coverLetterData]);

  /** Profils principaux (un par slug, en privilégiant la langue courante). */
  const profiles = useMemo(() => {
    const mains = allRows.filter((p) => !p.is_adaptation);
    const bySlug = new Map<string, CVProfile>();
    for (const m of mains) {
      const current = bySlug.get(m.slug);
      if (!current || (m.locale === locale && current.locale !== locale)) bySlug.set(m.slug, m);
    }
    return [...bySlug.values()];
  }, [allRows, locale]);

  /** Adaptations du profil sélectionné — regroupées par SLUG (toutes langues
   *  confondues) et non par une seule ligne DB. Une adaptation créée dans une
   *  autre langue (offre rédigée dans l'autre langue) reste ainsi visible :
   *  c'était la cause des CV adaptés « parfois présents, parfois non ». */
  const versions = useMemo(() => {
    const mainIds = new Set(
      allRows.filter((r) => !r.is_adaptation && r.slug === selectedProfile).map((r) => r.id)
    );
    return allRows.filter((p) => p.is_adaptation && p.parent_id != null && mainIds.has(p.parent_id));
  }, [allRows, selectedProfile]);

  // On récupère TOUTES les langues (pas de filtre `locale`) : le regroupement
  // par slug ci-dessus a besoin des adaptations de toutes les langues.
  const fetchProfiles = useCallback(async (): Promise<CVProfile[]> => {
    try {
      const res = await fetch(`/api/cv-profiles`);
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
  }, []);

  /** Charge un CV (ligne DB) dans l'éditeur sans déclencher l'auto-save. */
  const loadRow = useCallback((row: { cv_data: CVData; template: string; id: string; cover_letter?: CoverLetterData | null }) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    isInitialLoad.current = true;
    const cv = injectIds(row.cv_data);
    setCurrentCV(cv);
    setSelectedTemplate(normalizeTemplate(row.template));
    setCoverLetterData(row.cover_letter ?? null);
    setCurrentProfileId(row.id);
    lastSavedRef.current = JSON.stringify(cv);
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
  }, []);

  const loadFallback = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    isInitialLoad.current = true;
    const fallback = getFallbackCV("default");
    setCurrentCV(fallback);
    setSelectedTemplate("default");
    setMainProfileId(null);
    setCurrentProfileId(null);
    lastSavedRef.current = JSON.stringify(fallback);
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
  }, []);

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
      // Profil principal de la langue courante en priorité, sinon n'importe lequel.
      const main =
        rows.find((r) => r.slug === slug && !r.is_adaptation && r.locale === locale) ??
        rows.find((r) => r.slug === slug && !r.is_adaptation);
      if (main) {
        setMainProfileId(main.id);
        loadRow(main);
      } else {
        loadFallback();
      }
      resetStatus();
    },
    [fetchProfiles, loadRow, loadFallback, resetStatus, locale]
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
          const { adaptedCV, originalCV: origCV, profile, template: pendingTemplate, model: pendingModel } = JSON.parse(pending);
          setCurrentCV(adaptedCV);
          setOriginalCV(origCV);
          setIsAdapted(true);
          setSelectedProfile(profile);
          const template = normalizeTemplate(pendingTemplate);
          setSelectedTemplate(template);
          setStatus("success");
          setStatusMessage(t("status_success_cv", { provider: getModelName(pendingModel ?? DEFAULT_MODEL) }));
          setStatusDetails(null);
          lastSavedRef.current = JSON.stringify(adaptedCV);

          // Persiste l'adaptation en DB (sinon elle n'existerait qu'en mémoire
          // et serait perdue au prochain rechargement / autre navigateur).
          try {
            const rows = await fetchProfiles();
            if (cancelled) return;
            const main =
              rows.find((r) => r.slug === profile && !r.is_adaptation && r.locale === locale) ??
              rows.find((r) => r.slug === profile && !r.is_adaptation);
            if (main) setMainProfileId(main.id);
            const res = await fetch("/api/cv-profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                slug: `${profile}-adapt-${Date.now()}`,
                name: adaptationName(adaptedCV, locale),
                locale,
                template,
                cv_data: adaptedCV,
                original_cv: origCV,
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

  /** Change de template ET aligne la structure du layout. Le CV canadien est
   *  mono-colonne (sans photo) ; basculer vers/depuis lui réinitialise la
   *  structure des pages tout en préservant le thème et les titres renommés.
   *  Les bascules entre templates de même structure (default ↔ modern) ne
   *  touchent pas au layout. */
  const changeTemplate = useCallback((template: string) => {
    setSelectedTemplate(template);
    setCurrentCV((prev) => migrateLayoutForTemplate(prev, template));
  }, []);

  /** Crée un nouveau profil principal à partir d'un template VIDE, le
   *  sauvegarde en base, puis bascule dessus — les données se remplissent
   *  ensuite via l'onglet "Edit CV". */
  const createProfile = useCallback(
    async (name: string, template = "default"): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const slug =
        trimmed.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `profil-${Date.now()}`;

      const blank = injectIds(emptyCV(template));
      blank.personalInfo = { ...blank.personalInfo, name: trimmed };

      try {
        const res = await fetch("/api/cv-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            name: trimmed,
            locale,
            template,
            cv_data: blank,
            is_adaptation: false,
            parent_id: null,
          }),
        });
        if (!res.ok) throw new Error("create failed");
        await fetchProfiles();
        setCoverLetterData(null);
        setSelectedProfile(slug); // le useEffect recharge le profil créé
        return true;
      } catch {
        // DB indisponible : on ouvre quand même un CV vierge en mémoire
        setCoverLetterData(null);
        setSelectedProfile(slug);
        return false;
      }
    },
    [locale, fetchProfiles]
  );

  /** Bascule entre CV principal et une adaptation (dropdown de versions). */
  const selectVersion = useCallback(
    (id: string) => {
      const row = allRows.find((r) => r.id === id);
      if (!row) return;
      loadRow(row);
      if (row.is_adaptation) {
        // Diff stable : on utilise le snapshot du CV original capturé lors de
        // l'adaptation (même langue, figé), sinon on retombe sur le CV parent
        // courant pour les anciennes adaptations sans snapshot.
        if (row.original_cv) {
          setOriginalCV(injectIds(row.original_cv));
        } else {
          const main = allRows.find((r) => r.id === row.parent_id);
          setOriginalCV(main ? injectIds(main.cv_data) : null);
        }
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
            name: adaptationName(adaptedCV, locale),
            locale,
            template: selectedTemplate,
            cv_data: adaptedCV,
            original_cv: mainCV,
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
      loadFallback();
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
              cover_letter: coverLetterRef.current,
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
            body: JSON.stringify({ cv_data: cvData, template: selectedTemplate, cover_letter: coverLetterRef.current }),
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

  // Auto-save de la lettre de motivation (1,5 s après la dernière édition).
  // Indépendant du CV : une modification de la seule lettre déclenche aussi une
  // persistance. La lettre est rattachée à la ligne DB du profil courant.
  useEffect(() => {
    if (!currentProfileId) return;
    const snapshot = JSON.stringify(coverLetterData ?? null);
    // Profil fraîchement chargé/changé → on fixe la base sans sauvegarder.
    if (letterProfileRef.current !== currentProfileId) {
      letterProfileRef.current = currentProfileId;
      lastSavedLetterRef.current = snapshot;
      return;
    }
    if (snapshot === lastSavedLetterRef.current) return;

    if (letterSaveTimer.current) clearTimeout(letterSaveTimer.current);
    letterSaveTimer.current = setTimeout(() => {
      fetch(`/api/cv-profiles/${currentProfileId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_letter: coverLetterData }),
      })
        .then((res) => {
          if (res.ok) lastSavedLetterRef.current = snapshot;
        })
        .catch(() => {});
    }, 1500);

    return () => {
      if (letterSaveTimer.current) clearTimeout(letterSaveTimer.current);
    };
  }, [coverLetterData, currentProfileId]);

  /** Renomme un profil (champ `name` uniquement — le slug reste stable). */
  const renameProfile = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const res = await fetch(`/api/cv-profiles/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) throw new Error("rename failed");
        await fetchProfiles();
        return true;
      } catch {
        return false;
      }
    },
    [fetchProfiles]
  );

  /** Supprime un profil (et, via ON DELETE, dissocie ses adaptations) puis
   *  bascule sur un autre profil principal (ou un CV vierge s'il n'en reste pas). */
  const deleteProfile = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/cv-profiles/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
        const remaining = await fetchProfiles();
        const others = remaining.filter((r) => !r.is_adaptation && r.id !== id);
        setCoverLetterData(null);
        if (others.length > 0) {
          setSelectedProfile(others[0].slug);
        } else {
          loadFallback();
          setSelectedProfile("omar");
        }
        return true;
      } catch {
        return false;
      }
    },
    [fetchProfiles, loadFallback]
  );

  /** Supprime un CV adapté (version) puis revient au CV principal. */
  const deleteVersion = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/cv-profiles/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("delete failed");
        await fetchProfiles();
        if (mainProfileId) selectVersion(mainProfileId);
        else loadFallback();
        return true;
      } catch {
        return false;
      }
    },
    [fetchProfiles, mainProfileId, selectVersion, loadFallback]
  );

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
    changeTemplate,
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
    handleProfileChange,
    createProfile,
    renameProfile,
    deleteProfile,
    deleteVersion,
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
