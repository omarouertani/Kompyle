import { APP_VERSION, RELEASE_MANIFEST, compareVersions, isReleaseManifest, releasesAfter, type Release } from "@/lib/release";

/**
 * GET /api/update-check — une version plus récente de Kompyle est-elle publiée ?
 *
 * Le serveur lit le `release.json` de la branche principale du dépôt (GitHub)
 * et le compare à la version de CE build. Aucune donnée utilisateur n'est
 * envoyée : c'est un simple téléchargement d'un fichier public.
 *
 * Variables d'environnement (facultatives) :
 *   KOMPYLE_UPDATE_CHECK=false    désactive la vérification
 *   KOMPYLE_UPDATE_URL=<url>      autre manifeste (fork, miroir interne)
 */

export interface UpdateCheckResponse {
  enabled: boolean;
  current: string;
  latest: string;
  updateAvailable: boolean;
  /** Releases publiées après la version installée (plus récente d'abord). */
  releases: Release[];
  repository: string;
}

/** Résultat mis en cache : GitHub n'est interrogé qu'une fois toutes les 6 h. */
const CACHE_MS = 6 * 60 * 60 * 1000;
let cache: { at: number; releases: Release[] | null } | null = null;

function manifestUrl(): string {
  return (
    process.env.KOMPYLE_UPDATE_URL ||
    `https://raw.githubusercontent.com/${RELEASE_MANIFEST.repository}/main/release.json`
  );
}

async function fetchRemoteReleases(): Promise<Release[] | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.releases;
  let releases: Release[] | null = null;
  try {
    const res = await fetch(manifestUrl(), { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (res.ok) {
      const data: unknown = await res.json();
      if (isReleaseManifest(data)) releases = data.releases;
    }
  } catch {
    // hors ligne / GitHub indisponible : pas d'avis de mise à jour, sans erreur
  }
  cache = { at: Date.now(), releases };
  return releases;
}

export async function GET() {
  const base: UpdateCheckResponse = {
    enabled: process.env.KOMPYLE_UPDATE_CHECK !== "false",
    current: APP_VERSION,
    latest: APP_VERSION,
    updateAvailable: false,
    releases: [],
    repository: RELEASE_MANIFEST.repository,
  };
  if (!base.enabled) return Response.json(base);

  const remote = await fetchRemoteReleases();
  if (!remote?.length) return Response.json(base);

  const newer = releasesAfter(remote, APP_VERSION);
  const latest = remote.reduce((max, r) => (compareVersions(r.version, max) > 0 ? r.version : max), APP_VERSION);
  return Response.json({ ...base, latest, updateAvailable: newer.length > 0, releases: newer } satisfies UpdateCheckResponse);
}
