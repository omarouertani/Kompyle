import type { AIProvider } from "@/types/cv";

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
    for (const p of ["openrouter", "google", "openai", "anthropic", "groq", "mistral"] as AIProvider[]) {
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
