import type { AIProvider } from "@/types/cv";

// ─── Catalogue de modèles multi-provider ──────────────────────────────────────
// Source de vérité unique, importable côté serveur (orchestrateur) ET client
// (sélecteur UI). Module pur (aucun "use client", aucune dépendance React).
//
// BYOK : Google Gemini, Groq, OpenRouter (`:free`) et NVIDIA NIM ont une offre
// GRATUITE avec une clé personnelle ; Anthropic et OpenAI sont PAYANTS.
//
// Ids vérifiés le 2026-11-11 (doc officielle de chaque provider + endpoints
// publics OpenRouter / NVIDIA). Les modèles gratuits changent vite : tout est
// centralisé ici → un seul fichier à ajuster.
//
// ⚠️ Un id de modèle doit être UNIQUE tous providers confondus : le provider
// est déduit de l'id (`providerForModel`) et l'id sert de valeur au sélecteur.

export interface OpenRouterModel {
  /** Identifiant de modèle, passé tel quel comme paramètre `model` de l'API du provider. */
  model: string;
  name: string;
}

/** Modèles proposés par provider (ordre = priorité d'affichage ET de secours). */
export const MODELS_BY_PROVIDER: Record<AIProvider, OpenRouterModel[]> = {
  google: [
    { model: "gemini-3.6-flash", name: "Gemini 3.6 Flash" },
    { model: "gemini-3.8-flash", name: "Gemini 3.8 Flash" },
    { model: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite" },
    { model: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite" },
  ],
  groq: [
    { model: "openai/gpt-oss-120b", name: "GPT-OSS 120B" },
    { model: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { model: "openai/gpt-oss-20b", name: "GPT-OSS 20B" },
  ],
  openrouter: [
    // Gratuits (suffixe `:free`) — gros contexte, JSON structuré annoncé.
    { model: "nvidia/nemotron-3.5-super-vl:free", name: "Nemotron 3.5 Super" },
    { model: "google/gemma-4-31b-it:free", name: "Gemma 4 31B" },
    { model: "baidu/ernie-5.5-flash-preview:free", name: "ERNIE 5.5 Flash" },
    // Routeur OpenRouter : choisit un modèle gratuit disponible (filet de sécurité).
    { model: "openrouter/free", name: "OpenRouter Auto" },
  ],
  nvidia: [
    { model: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B" },
    { model: "deepseek-ai/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash" },
    { model: "z-ai/glm-5.3-flash", name: "GLM 5.3 Flash" },
    { model: "moonshotai/kimi-k2.6", name: "Kimi K2.6" },
  ],
  anthropic: [
    { model: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
    { model: "claude-opus-5-5", name: "Claude Opus 5.5" },
    { model: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
  ],
  openai: [
    { model: "gpt-6.1-terra", name: "GPT-6.1 Terra" },
    { model: "gpt-6.1-sol", name: "GPT-6.1 Sol" },
    { model: "gpt-6-luna", name: "GPT-6 Luna" },
  ],
};

/** Ordre d'affichage des providers (gratuits d'abord). */
export const PROVIDERS: AIProvider[] = ["google", "groq", "openrouter", "nvidia", "anthropic", "openai"];

/** Providers ayant une offre gratuite (clé perso) : secours automatique autorisé. */
export const FREE_PROVIDERS: ReadonlySet<AIProvider> = new Set<AIProvider>(["google", "groq", "openrouter", "nvidia"]);

/** Page de création de clé API, par provider. */
export const PROVIDER_KEY_URLS: Record<AIProvider, string> = {
  google: "https://aistudio.google.com/apikey",
  groq: "https://console.groq.com/keys",
  openrouter: "https://openrouter.ai/keys",
  nvidia: "https://build.nvidia.com/settings/api-keys",
  anthropic: "https://platform.claude.com/settings/keys",
  openai: "https://platform.openai.com/api-keys",
};

/** Garde de type : chaîne = provider encore supporté (ex. "mistral" → false). */
export function isKnownProvider(value: unknown): value is AIProvider {
  return typeof value === "string" && (PROVIDERS as string[]).includes(value);
}

/** Tous les modèles, à plat (lookups). */
const ALL_MODELS: { provider: AIProvider; model: string; name: string }[] = PROVIDERS.flatMap(
  (p) => MODELS_BY_PROVIDER[p].map((m) => ({ provider: p, ...m })),
);

/** Modèle utilisé par défaut quand l'utilisateur n'en sélectionne aucun. */
export const DEFAULT_MODEL = "gemini-3.6-flash";

/** Premier modèle du catalogue d'un provider (modèle par défaut du provider). */
export function defaultModelFor(provider: AIProvider): string {
  return MODELS_BY_PROVIDER[provider][0].model;
}

/**
 * Chaîne de secours PAR PROVIDER : uniquement pour les providers gratuits (même
 * clé → aucun coût). Les providers payants n'ont pas de secours (mode strict :
 * un seul modèle, aucun coût surprise). On ne bascule JAMAIS vers un autre
 * provider : le CV partirait chez un tiers sans l'accord de l'utilisateur.
 */
export const FALLBACK_MODELS: Record<AIProvider, string[]> = {
  google: MODELS_BY_PROVIDER.google.map((m) => m.model),
  groq: MODELS_BY_PROVIDER.groq.map((m) => m.model),
  openrouter: MODELS_BY_PROVIDER.openrouter.map((m) => m.model),
  nvidia: ["nvidia/nemotron-3-super-120b-a12b", "deepseek-ai/deepseek-v4.1-flash", "z-ai/glm-5.3-flash"],
  anthropic: [],
  openai: [],
};

/** Vrai si l'id fait partie du catalogue actuel. */
export function isKnownModel(model: string): boolean {
  return ALL_MODELS.some((m) => m.model === model);
}

/** Provider auquel appartient un identifiant de modèle (défaut: openrouter). */
export function providerForModel(model: string): AIProvider {
  return ALL_MODELS.find((m) => m.model === model)?.provider ?? "openrouter";
}

/** Libellé lisible d'un identifiant de modèle (pour l'UI / les toasts). */
export function getModelName(model: string): string {
  return ALL_MODELS.find((m) => m.model === model)?.name ?? model;
}
