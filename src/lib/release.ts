import manifest from "../../release.json";

/**
 * Versions et nouveautés de Kompyle, lues depuis `release.json` (racine du
 * dépôt) — SOURCE UNIQUE : la version affichée, l'avis de mise à jour et la
 * visite « Nouveautés » en dérivent. Une release `feature` est montrée aux
 * utilisateurs (et ses fonctionnalités rejoignent la visite guidée) ; une
 * release `fix` n'est annoncée que comme mise à jour disponible.
 */

export type ReleaseType = "feature" | "fix";
export type Localized = { fr: string; en: string };

export interface ReleaseFeature {
  id: string;
  /** Valeur `data-tour` de l'élément à mettre en avant (sinon : au centre). */
  target?: string;
  title: Localized;
  body: Localized;
}

export interface Release {
  version: string;
  date: string;
  type: ReleaseType;
  summary: Localized;
  features?: ReleaseFeature[];
}

export interface ReleaseManifest {
  repository: string;
  releases: Release[];
}

export const RELEASE_MANIFEST = manifest as ReleaseManifest;

/** Version de CE build (la release la plus récente du manifeste embarqué). */
export const APP_VERSION: string = RELEASE_MANIFEST.releases[0]?.version ?? "0.0.0";

/** Compare deux versions « x.y.z » : < 0 si a < b, 0 si égales, > 0 si a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Releases strictement plus récentes que `version` (plus récente d'abord). */
export function releasesAfter(releases: Release[], version: string): Release[] {
  return releases.filter((r) => compareVersions(r.version, version) > 0);
}

/** Fonctionnalités apportées par les releases `feature` postérieures à `version`. */
export function featuresAfter(releases: Release[], version: string): ReleaseFeature[] {
  return releasesAfter(releases, version)
    .filter((r) => r.type === "feature")
    .flatMap((r) => r.features ?? []);
}

/** Toutes les fonctionnalités annoncées (pour la visite guidée complète). */
export function allFeatures(releases: Release[] = RELEASE_MANIFEST.releases): ReleaseFeature[] {
  return releases.filter((r) => r.type === "feature").flatMap((r) => r.features ?? []);
}

export const pickLocale = (text: Localized, locale: string): string => (locale === "en" ? text.en : text.fr);

/** Validation minimale d'un manifeste distant (donnée externe). */
export function isReleaseManifest(v: unknown): v is ReleaseManifest {
  if (!v || typeof v !== "object") return false;
  const m = v as Partial<ReleaseManifest>;
  return (
    Array.isArray(m.releases) &&
    m.releases.every(
      (r) =>
        r && typeof r.version === "string" && /^\d+\.\d+\.\d+$/.test(r.version) &&
        (r.type === "feature" || r.type === "fix") &&
        r.summary && typeof r.summary.fr === "string" && typeof r.summary.en === "string"
    )
  );
}
