"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import { APP_VERSION, RELEASE_MANIFEST, compareVersions, featuresAfter, pickLocale, type ReleaseFeature } from "@/lib/release";

/** Clé localStorage : visite complète déjà faite (ou passée). */
const TOUR_KEY = "kompyle_tour_v1";
/** Clé localStorage : dernière version de Kompyle dont l'utilisateur a vu les nouveautés. */
const SEEN_VERSION_KEY = "kompyle_seen_version";
/** Version dont la visite de base (STEPS) couvre déjà les fonctionnalités : les
 *  fonctionnalités des versions PLUS RÉCENTES s'ajoutent à la visite complète. */
const TOUR_BASE_VERSION = "0.2.0";
/** Événement global pour relancer la visite (bouton « ? » de l'en-tête). */
export const START_TOUR_EVENT = "kompyle:start-tour";

export function requestTour(): void {
  window.dispatchEvent(new Event(START_TOUR_EVENT));
}

/** Étapes : élément ciblé (attribut data-tour) + clé de texte. Une étape sans
 *  cible s'affiche au centre de l'écran. */
const STEPS: { key: string; target?: string; side?: "top" | "bottom" | "left" | "right" }[] = [
  { key: "welcome" },
  { key: "api_keys", target: "api-keys", side: "bottom" },
  { key: "profiles", target: "profiles", side: "right" },
  { key: "composer", target: "composer", side: "right" },
  { key: "doc_tabs", target: "doc-tabs", side: "bottom" },
  { key: "cv_controls", target: "cv-controls", side: "bottom" },
  { key: "toolbar", target: "canvas-toolbar", side: "bottom" },
  { key: "page", target: "cv-page", side: "left" },
  { key: "export", target: "export", side: "bottom" },
  { key: "letter", target: "letter-tab", side: "bottom" },
  { key: "ats", target: "ats-tab", side: "bottom" },
  { key: "prefs", target: "prefs", side: "bottom" },
  { key: "done" },
];

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage indisponible : la visite pourra se relancer, sans gravité
  }
};
const exists = (target?: string) => !target || !!document.querySelector(`[data-tour="${target}"]`);

interface OnboardingTourProps {
  /** Vrai quand l'interface est prête (premier chargement terminé). */
  ready: boolean;
  /** Met l'interface dans l'état attendu par la visite (onglet CV, panneau ouvert). */
  prepare: () => void;
}

/**
 * Visite guidée (Driver.js) :
 *  - PREMIÈRE ouverture → visite complète (base + fonctionnalités ajoutées depuis) ;
 *  - après une MISE À JOUR apportant des fonctionnalités → visite « Nouveautés »
 *    limitée à ce qui est nouveau (les releases de correctifs ne déclenchent rien) ;
 *  - bouton « ? » de l'en-tête → visite complète à la demande.
 * Les nouveautés sont décrites dans `release.json` (voir src/lib/release.ts).
 */
export function OnboardingTour({ ready, prepare }: OnboardingTourProps) {
  const t = useTranslations("Tour");
  const locale = useLocale();
  /** Visite en cours (état lu sur Driver.js lui-même, pas sur un hook de fin). */
  const tourRef = useRef<Driver | null>(null);
  // Lu via une ref : la visite ne doit pas dépendre des re-rendus de la page.
  const prepareRef = useRef(prepare);
  useEffect(() => {
    prepareRef.current = prepare;
  });

  /** Étape Driver.js d'une fonctionnalité décrite dans release.json. */
  const featureStep = useCallback(
    (f: ReleaseFeature): DriveStep => ({
      ...(f.target ? { element: `[data-tour="${f.target}"]` } : {}),
      popover: {
        title: pickLocale(f.title, locale),
        // HTML de NOTRE manifeste (versionné dans le dépôt), jamais de l'utilisateur.
        description: pickLocale(f.body, locale),
        ...(f.target ? { side: "bottom" as const, align: "start" as const } : {}),
      },
    }),
    [locale]
  );

  const run = useCallback(
    (buildSteps: () => DriveStep[]) => {
      if (tourRef.current?.isActive()) return;
      prepareRef.current();
      // Laisse l'interface se mettre en place (onglet, panneau) avant de mesurer.
      window.setTimeout(() => {
        const steps = buildSteps();
        if (steps.length === 0) return;
        // Vue = faite : un rechargement en pleine visite ne la réimpose pas.
        write(TOUR_KEY, "done");
        write(SEEN_VERSION_KEY, APP_VERSION);
        const tour = driver({
          steps,
          showProgress: steps.length > 1,
          progressText: t.raw("progress") as string, // « {{current}} / {{total}} » : syntaxe Driver.js, pas ICU
          nextBtnText: t("next"),
          prevBtnText: t("prev"),
          doneBtnText: t("finish"),
          popoverClass: "kompyle-tour",
          overlayColor: "rgb(20 16 12)",
          overlayOpacity: 0.55,
          stagePadding: 6,
          stageRadius: 12,
          smoothScroll: true,
          allowClose: true,
          // Pendant la visite on regarde, on ne clique pas dans l'app.
          disableActiveInteraction: true,
        });
        tourRef.current = tour;
        tour.drive();
      }, 350);
    },
    [t]
  );

  /** Visite complète : étapes de base + fonctionnalités apparues depuis. */
  const startFull = useCallback(() => {
    run(() => {
      const base: DriveStep[] = STEPS.filter((s) => exists(s.target)).map((s) => ({
        ...(s.target ? { element: `[data-tour="${s.target}"]` } : {}),
        popover: {
          title: t(`${s.key}_title`),
          // Texte riche (gras, listes) : HTML venu de NOS catalogues, jamais de l'utilisateur.
          description: t.raw(`${s.key}_body`) as string,
          ...(s.side ? { side: s.side, align: "start" as const } : {}),
        },
      }));
      const added = featuresAfter(RELEASE_MANIFEST.releases, TOUR_BASE_VERSION)
        .filter((f) => exists(f.target))
        .map(featureStep);
      // Les nouveautés juste avant l'étape finale.
      return [...base.slice(0, -1), ...added, ...base.slice(-1)];
    });
  }, [run, t, featureStep]);

  /** Visite « Nouveautés » : uniquement les fonctionnalités apparues depuis `since`. */
  const startWhatsNew = useCallback(
    (features: ReleaseFeature[]) => {
      run(() => {
        const steps = features.filter((f) => exists(f.target)).map(featureStep);
        if (steps.length === 0) return [];
        return [
          {
            popover: {
              title: t("whats_new_title", { version: APP_VERSION }),
              description: t("whats_new_body", { count: steps.length }),
            },
          },
          ...steps,
        ];
      });
    },
    [run, t, featureStep]
  );

  // À l'ouverture : visite complète (1re fois) ou nouveautés (après une mise à jour).
  useEffect(() => {
    if (!ready) return;
    const tourDone = read(TOUR_KEY) === "done";
    const seen = read(SEEN_VERSION_KEY);
    let timer: number | undefined;
    if (!tourDone) {
      timer = window.setTimeout(startFull, 900);
    } else if (!seen) {
      // Visite déjà faite avant le suivi des versions : on part de la version actuelle.
      write(SEEN_VERSION_KEY, APP_VERSION);
    } else if (compareVersions(seen, APP_VERSION) < 0) {
      const features = featuresAfter(RELEASE_MANIFEST.releases, seen);
      if (features.length > 0) timer = window.setTimeout(() => startWhatsNew(features), 900);
      else write(SEEN_VERSION_KEY, APP_VERSION); // correctifs seulement : rien à montrer
    }
    return () => window.clearTimeout(timer);
  }, [ready, startFull, startWhatsNew]);

  // Relance à la demande (bouton « ? »).
  useEffect(() => {
    window.addEventListener(START_TOUR_EVENT, startFull);
    return () => window.removeEventListener(START_TOUR_EVENT, startFull);
  }, [startFull]);

  return null;
}
