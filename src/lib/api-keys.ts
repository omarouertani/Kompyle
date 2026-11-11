import type { AIProvider } from "@/types/cv";
import { PROVIDERS, isKnownProvider } from "@/lib/ai-models";

// ─── Store BYOK des clés API (localStorage) ───────────────────────────────────
// App locale / open-source : chaque utilisateur saisit ses propres clés. Stockées
// en clair dans le navigateur (jamais commitées, jamais envoyées ailleurs que vers
// le provider choisi via les routes locales). Même pattern singleton + listeners
// que `use-ats-checked-versions` pour rester compatible `useSyncExternalStore`.

const STORAGE_KEY = "kompyle.apiKeys";

export type ApiKeys = Partial<Record<AIProvider, string>>;

let snapshot: ApiKeys = {};
let initialized = false;
const listeners = new Set<() => void>();

function readStorage(): ApiKeys {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: ApiKeys = {};
    // Seuls les providers ENCORE supportés sont lus : une clé d'un provider
    // retiré (ex. "mistral") est ignorée, sans planter.
    for (const p of PROVIDERS) {
      const v = (parsed as Record<string, unknown>)[p];
      if (typeof v === "string" && v.trim()) out[p] = v.trim();
    }
    return out;
  } catch {
    return {};
  }
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  snapshot = readStorage();
}

export function subscribe(cb: () => void) {
  ensureInit();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getSnapshot(): ApiKeys {
  ensureInit();
  return snapshot;
}

const EMPTY: ApiKeys = {};
export function getServerSnapshot(): ApiKeys {
  return EMPTY;
}

/** Définit (ou efface si vide) la clé d'un provider et persiste. */
export function writeKey(provider: AIProvider, key: string) {
  const trimmed = key.trim();
  const next: ApiKeys = { ...snapshot };
  if (trimmed) next[provider] = trimmed;
  else delete next[provider];
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota plein / mode privé : perte acceptée au prochain reload
  }
  for (const l of listeners) l();
}

/**
 * Noms des providers RETIRÉS (ex. "mistral") pour lesquels une clé est encore
 * enregistrée. Lecture brute du stockage : à appeler côté client uniquement.
 */
export function readRetiredProviders(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([p, v]) => !isKnownProvider(p) && typeof v === "string" && v.trim() !== "")
      .map(([p]) => p);
  } catch {
    return [];
  }
}

/** Supprime du stockage les clés des providers retirés (garde les autres). */
export function forgetRetiredKeys() {
  ensureInit();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // stockage indisponible : rien à nettoyer
  }
}
