"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CVData, CVLang, CoverLetterData } from "@/types/cv";
import { isCVLang } from "@/lib/cv-i18n";
import { isSampleCV } from "@/lib/cv-import/apply";
import { defaultLayout, normalizeTemplate, migrateLayoutForTemplate } from "@/lib/cv-layout";
import { applyTemplateTheme } from "@/lib/cv-templates";
import { bakeFreeElementPositions } from "@/lib/free-elements";
import { mockCV } from "@/lib/mock-cv";
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

/** Clé localStorage : slug du profil actif, pour le RESTAURER au rechargement.
 *  Avant, le profil actif était figé sur "omar" et jamais persisté → au reload,
 *  le CV de l'utilisateur disparaissait au profit du CV d'exemple. */
const ACTIVE_PROFILE_KEY = "kompyle_active_profile";

/** Mémorise le profil actif tout de suite (avant une bascule de langue qui
 *  remonte la page, sans attendre l'effet de persistance). */
export function rememberActiveProfile(slug: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_KEY, slug);
  } catch {
    // stockage indisponible (navigation privée) — on continue sans persistance
  }
}

function readStoredProfile(): string {
  try {
    return localStorage.getItem(ACTIVE_PROFILE_KEY) || "";
  } catch {
    return "";
  }
}

/** Slug URL-safe à partir d'un nom libre (accents retirés). Vide → identifiant
 *  horodaté de repli. Partagé par la création de profil et la persistance du
 *  CV d'exemple (premier enregistrement d'un fallback). */
function slugify(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `profil-${Date.now()}`
  );
}

/** Les profils vivent en base. À défaut (BD indisponible, ou tout premier
 *  démarrage sans aucun profil), on démarre sur un CV d'EXEMPLE (mock) plutôt
 *  que vierge : chaque nouvel utilisateur voit des templates remplis, qu'il
 *  remplace ensuite champ par champ par ses propres données. */
function getFallbackCV(template: string, lang: CVLang): CVData {
  return injectIds(mockCV(template, lang));
}

/** CV d'exemple dans la langue de l'UI, à partir d'un CV d'exemple enregistré
 *  dans l'AUTRE langue : on garde ce qui ne dépend pas de la langue (nom, photo,
 *  mise en page, thème) et on prend le contenu d'exemple traduit. */
function localizedSample(sample: CVData, template: string, lang: CVLang): CVData {
  const mock = mockCV(template, lang);
  return injectIds({
    ...mock,
    personalInfo: {
      ...mock.personalInfo,
      name: sample.personalInfo?.name || mock.personalInfo.name,
      ...(sample.personalInfo?.photo ? { photo: sample.personalInfo.photo } : {}),
    },
    layout: sample.layout ?? mock.layout,
  });
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
  // Vide au départ (même rendu SSR/hydratation) : le slug réel est résolu au
  // montage (localStorage → 1er profil en base → CV d'exemple si BD vide).
  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("default");
  const [allRows, setAllRows] = useState<CVProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  // Vrai UNIQUEMENT tant que le tout premier chargement n'est pas résolu. Sert à
  // n'afficher le loader (et masquer le CV d'exemple) qu'au démarrage : les
  // changements de profil ultérieurs mettent à jour l'aperçu sur place, sans
  // flash de loader.
  const [initialLoading, setInitialLoading] = useState(true);
  /** Ligne DB du profil principal (jamais une adaptation). */
  const [mainProfileId, setMainProfileId] = useState<string | null>(null);
  /** Ligne DB actuellement éditée (profil principal OU adaptation). */
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  const uiLang: CVLang = isCVLang(locale) ? locale : "fr";
  const [currentCV, setCurrentCV] = useState<CVData>(() => getFallbackCV("default", uiLang));
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
  // Slug dont le PROCHAIN re-run de l'effet doit être ignoré (une seule fois) :
  // évite un rechargement redondant — et un double flash du loader — quand une
  // resynchronisation interne de `selectedProfile` (slug résolu, CV adapté en
  // attente) redéclenche l'effet. Consommé au 1er passage, donc une re-sélection
  // ultérieure du même profil par l'utilisateur recharge bien normalement.
  const resyncSkipRef = useRef<string | null>(null);

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
    const fallback = getFallbackCV("default", uiLang);
    setCurrentCV(fallback);
    setSelectedTemplate("default");
    setMainProfileId(null);
    setCurrentProfileId(null);
    lastSavedRef.current = JSON.stringify(fallback);
    setHasUnsavedChanges(false);
    setSaveStatus("idle");
  }, [uiLang]);

  const resetStatus = useCallback(() => {
    setOriginalCV(null);
    setIsAdapted(false);
    setStatus("idle");
    setStatusMessage("");
    setStatusDetails(null);
  }, []);

  /** Charge le profil principal `slug` depuis l'API. Robuste :
   *   1. le profil `slug` dans la langue courante ; 2. `slug` dans une autre
   *   langue ; 3. À DÉFAUT (slug vide/supprimé au tout premier démarrage), le
   *   PREMIER profil réel — jamais le CV d'exemple tant qu'il existe un profil.
   *   Le CV d'exemple (fallback) ne sort que si la base est réellement vide.
   *   Synchronise `selectedProfile` (donc localStorage) quand on retombe sur un
   *   autre slug. `isCancelled` : ne rien appliquer si un chargement plus récent
   *   l'a supplanté (course lors d'un changement rapide de profil/langue). */
  const loadMainProfile = useCallback(
    async (slug: string, isCancelled?: () => boolean): Promise<string> => {
      const rows = await fetchProfiles();
      if (isCancelled?.()) return slug;
      const mains = rows.filter((r) => !r.is_adaptation);
      const main =
        (slug ? mains.find((r) => r.slug === slug && r.locale === locale) : undefined) ??
        (slug ? mains.find((r) => r.slug === slug) : undefined) ??
        mains.find((r) => r.locale === locale) ??
        mains[0];
      if (main) {
        setMainProfileId(main.id);
        if (main.locale !== locale && isSampleCV(main.cv_data)) {
          // Seul le CV d'EXEMPLE existe, dans l'autre langue : on l'affiche dans
          // la langue de l'UI. Aucune ligne n'existe encore pour cette langue
          // (currentProfileId null) : le 1er enregistrement la crée (même slug).
          loadRow({ ...main, cv_data: localizedSample(main.cv_data, main.template, uiLang), cover_letter: null });
          setCurrentProfileId(null);
        } else {
          loadRow(main);
        }
        resetStatus();
        return main.slug; // slug réellement chargé (l'appelant resynchronise la sélection)
      }
      loadFallback();
      resetStatus();
      return ""; // base vide → CV d'exemple
    },
    [fetchProfiles, loadRow, loadFallback, resetStatus, locale, uiLang]
  );

  // Chargement initial (+ CV adapté en attente après bascule de langue)
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    (async () => {
      // sort du corps synchrone de l'effet (évite les renders en cascade)
      await Promise.resolve();
      if (cancelled) return;

      const pending = sessionStorage.getItem("pending_adapted_cv");
      if (pending) {
        // La sélection est appliquée EN DERNIER (après la persistance DB) : la
        // changer ici déclencherait un re-run de l'effet dont le nettoyage
        // (cancelled=true) interromprait la sauvegarde en cours. On mémorise donc
        // le slug et on ne bascule la sélection qu'une fois le travail terminé.
        let pendingProfile: string | null = null;
        try {
          const { adaptedCV, originalCV: origCV, profile, template: pendingTemplate, model: pendingModel } = JSON.parse(pending);
          pendingProfile = profile;
          setCurrentCV(adaptedCV);
          setOriginalCV(origCV);
          setIsAdapted(true);
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
            if (!cancelled) {
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
            }
          } catch {
            // DB indisponible : l'adaptation reste éditable en mémoire
          }
        } catch (e) {
          console.error("Failed to parse pending adapted CV", e);
        } finally {
          sessionStorage.removeItem("pending_adapted_cv");
        }
        if (!cancelled) {
          setProfilesLoading(false);
          // Sélection en dernier : le re-run qui en découle est neutralisé par
          // resyncSkipRef, donc le profil principal n'écrase pas le CV adapté.
          if (pendingProfile) {
            resyncSkipRef.current = `${pendingProfile}::${locale}`;
            setSelectedProfile(pendingProfile);
          }
        }
        return;
      }

      // Slug à ouvrir : la sélection courante, sinon le dernier profil actif
      // persisté (localStorage). `loadMainProfile` retombe sur le 1er profil réel
      // si ce slug n'existe pas, et ne sort le CV d'exemple que si la BD est vide.
      const slug = selectedProfile || readStoredProfile();
      // Re-run provoqué par une resynchronisation interne (slug+locale déjà
      // chargés) → on ne recharge pas (évite le double flash du loader). La
      // locale fait partie du jeton pour ne pas court-circuiter un vrai
      // changement de langue. Consommé une seule fois.
      if (resyncSkipRef.current !== null && resyncSkipRef.current === `${slug}::${locale}`) {
        resyncSkipRef.current = null;
        setProfilesLoading(false);
        return;
      }
      setProfilesLoading(true);
      const resolved = await loadMainProfile(slug, isCancelled);
      if (cancelled) return;
      setProfilesLoading(false);
      // Aligne la sélection (et donc localStorage) sur le profil réellement
      // chargé — nécessaire quand le slug venait de localStorage (selectedProfile
      // encore vide) ou qu'on a dû retomber sur un autre profil. Le re-run que
      // cela déclenche est neutralisé par resyncSkipRef (pas de rechargement).
      if (resolved && resolved !== selectedProfile) {
        resyncSkipRef.current = `${resolved}::${locale}`;
        setSelectedProfile(resolved);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile, locale]);

  // Le tout premier chargement est terminé dès que `profilesLoading` retombe à
  // false une première fois ; ensuite, plus jamais de loader plein écran.
  // (Mis à jour pendant le rendu, pas dans un effet : pas de rendu en trop.)
  if (initialLoading && !profilesLoading) setInitialLoading(false);

  // Persiste le profil actif pour le restaurer au prochain démarrage (le flash du
  // CV d'exemple venait de l'absence totale de persistance de cette sélection).
  useEffect(() => {
    if (!selectedProfile) return;
    try {
      localStorage.setItem(ACTIVE_PROFILE_KEY, selectedProfile);
    } catch {
      // stockage indisponible (navigation privée) — on continue sans persistance
    }
  }, [selectedProfile]);

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
    const from = selectedTemplate;
    setSelectedTemplate(template);
    setCurrentCV((prev) => {
      const migrated = migrateLayoutForTemplate(prev, template);
      // Réorganisation AUTOMATIQUE à la sélection d'un template : on efface les
      // positions manuelles + la pagination figée pour que le canvas recalcule
      // une mise en page propre adaptée au nouveau modèle — l'utilisateur n'a
      // plus besoin de cliquer « réorganiser ».
      if (!migrated.layout) return migrated;
      return {
        ...migrated,
        layout: {
          ...migrated.layout,
          // Les modèles du registre portent leur thème (police, couleurs) : on
          // l'applique en gardant les réglages propres à l'utilisateur.
          theme: applyTemplateTheme(migrated.layout.theme, from, template),
          // Les éléments libres gardent leur place malgré l'effacement des positions.
          freeElements: bakeFreeElementPositions(migrated.layout),
          absolutePositions: undefined,
          autoPaginated: false,
        },
      };
    });
  }, [selectedTemplate]);

  /** Crée un nouveau profil principal à partir d'un template VIDE, le
   *  sauvegarde en base, puis bascule dessus — les données se remplissent
   *  ensuite via l'onglet "Edit CV".
   *  `initial` (import d'un CV) : le profil est créé directement avec ces
   *  données, UNE LIGNE PAR LANGUE fournie (même slug) — l'app affiche la
   *  version de la langue choisie. Si la base est indisponible, rien n'est
   *  ouvert (renvoie false) pour ne pas perdre le CV importé. */
  const createProfile = useCallback(
    async (name: string, template = "default", initial?: Partial<Record<CVLang, CVData>>): Promise<string | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const baseSlug = slugify(trimmed);
      // Un import ne doit jamais écraser un profil existant du même nom.
      const slug = initial && allRows.some((r) => r.slug === baseSlug) ? `${baseSlug}-${Date.now()}` : baseSlug;

      // Nouveau profil : pré-rempli avec des données d'EXEMPLE (mock) pour que
      // les templates ne s'affichent jamais vides. L'utilisateur remplace chaque
      // champ par ses vraies données — l'exemple disparaît au fur et à mesure.
      // Le nom saisi à la création prime sur le nom d'exemple.
      const versions: Partial<Record<CVLang, CVData>> = {};
      if (initial) {
        for (const [lang, cv] of Object.entries(initial) as [CVLang, CVData][]) versions[lang] = injectIds(cv);
      } else {
        const blank = injectIds(mockCV(template, uiLang));
        blank.personalInfo = { ...blank.personalInfo, name: trimmed };
        versions[uiLang] = blank;
      }

      try {
        const results = await Promise.all(
          (Object.entries(versions) as [CVLang, CVData][]).map(([lang, cv]) =>
            fetch("/api/cv-profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                slug,
                name: trimmed,
                locale: lang,
                template,
                cv_data: cv,
                is_adaptation: false,
                parent_id: null,
              }),
            })
          )
        );
        if (results.length === 0 || results.some((r) => !r.ok)) throw new Error("create failed");
        await fetchProfiles();
        setCoverLetterData(null);
        setSelectedProfile(slug); // le useEffect recharge le profil créé
        rememberActiveProfile(slug);
        return slug;
      } catch {
        if (initial) return null;
        // DB indisponible : on ouvre quand même un CV vierge en mémoire
        setCoverLetterData(null);
        setSelectedProfile(slug);
        return null;
      }
    },
    [uiLang, fetchProfiles, allRows]
  );

  /** Enregistre la version `lang` du profil principal `slug` (création ou mise à
   *  jour de la ligne de cette langue). Sert à garder les deux langues d'un CV
   *  importé à jour. Renvoie false si la base est indisponible. */
  const saveLocaleVersion = useCallback(
    async (slug: string, lang: CVLang, cv: CVData, template: string): Promise<boolean> => {
      if (!slug) return false;
      const data = injectIds(cv);
      const existing = allRows.find((r) => r.slug === slug && r.locale === lang && !r.is_adaptation);
      const name = existing?.name ?? allRows.find((r) => r.slug === slug && !r.is_adaptation)?.name ?? slug;
      try {
        const res = existing
          ? await fetch(`/api/cv-profiles/${existing.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cv_data: data, template }),
            })
          : await fetch("/api/cv-profiles", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, name, locale: lang, template, cv_data: data, is_adaptation: false, parent_id: null }),
            });
        if (!res.ok) return false;
        await fetchProfiles();
        return true;
      } catch {
        return false;
      }
    },
    [allRows, fetchProfiles]
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
          // que l'état visuel (canvas, layout…) persiste entre navigateurs. Le
          // slug/nom se dérivent du CV (ou de la sélection) — `selectedProfile`
          // peut désormais être vide (BD initialement vide), d'où ce repli.
          const displayName =
            (cvData.personalInfo?.name || "").replace(/<[^>]*>/g, "").trim() ||
            selectedProfile ||
            "Mon CV";
          const slug = selectedProfile || slugify(displayName);
          const res = await fetch("/api/cv-profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slug,
              name: displayName,
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
          setSelectedProfile(saved.slug);
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

  /** Lignes principales d'un même profil (une par langue) à partir d'une ligne. */
  const siblingIds = useCallback(
    (id: string): string[] => {
      const row = allRows.find((r) => r.id === id);
      if (!row) return [id];
      return allRows.filter((r) => !r.is_adaptation && r.slug === row.slug).map((r) => r.id);
    },
    [allRows]
  );

  /** Renomme un profil dans toutes ses langues (champ `name` uniquement — le slug reste stable). */
  const renameProfile = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      try {
        const results = await Promise.all(
          siblingIds(id).map((rowId) =>
            fetch(`/api/cv-profiles/${rowId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: trimmed }),
            })
          )
        );
        if (results.some((r) => !r.ok)) throw new Error("rename failed");
        await fetchProfiles();
        return true;
      } catch {
        return false;
      }
    },
    [fetchProfiles, siblingIds]
  );

  /** Supprime un profil dans toutes ses langues (et, via ON DELETE, dissocie ses
   *  adaptations) puis bascule sur un autre profil principal (ou un CV vierge
   *  s'il n'en reste pas). */
  const deleteProfile = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const ids = siblingIds(id);
        const results = await Promise.all(ids.map((rowId) => fetch(`/api/cv-profiles/${rowId}`, { method: "DELETE" })));
        if (results.some((r) => !r.ok)) throw new Error("delete failed");
        const remaining = await fetchProfiles();
        const others = remaining.filter((r) => !r.is_adaptation && !ids.includes(r.id));
        setCoverLetterData(null);
        if (others.length > 0) {
          setSelectedProfile(others[0].slug);
        } else {
          // Plus aucun profil : CV d'exemple, sélection remise à zéro (plus de
          // slug "omar" en dur qui pointait vers un profil inexistant).
          loadFallback();
          setSelectedProfile("");
          try {
            localStorage.removeItem(ACTIVE_PROFILE_KEY);
          } catch {
            // stockage indisponible — sans effet sur la logique
          }
        }
        return true;
      } catch {
        return false;
      }
    },
    [fetchProfiles, loadFallback, siblingIds]
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
    saveLocaleVersion,
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
    profiles,
    profilesLoading,
    initialLoading,
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
