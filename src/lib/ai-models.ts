import type { AIProvider } from "@/types/cv";

// ─── Catalogue de modèles multi-provider ──────────────────────────────────────
// Source de vérité unique, importable côté serveur (orchestrateur) ET client
// (sélecteur UI). Module pur (aucun "use client", aucune dépendance React).
//
// BYOK : OpenRouter sert les modèles GRATUITS (suffixe `:free`) ; Google / OpenAI /
// Anthropic exposent des modèles PAYANTS appelés avec la clé du provider.
//
// ⚠️ Les IDs payants doivent être vérifiés vis-à-vis de la doc de chaque provider.
// Tout est centralisé ici → un seul fichier à ajuster.

export interface OpenRouterModel {
  /** Identifiant de modèle, passé tel quel comme paramètre `model` de l'API du provider. */
  model: string;
  name: string;
}

/** Modèles proposés par provider (ordre = priorité d'affichage dans le sélecteur). */
export const MODELS_BY_PROVIDER: Record<AIProvider, OpenRouterModel[]> = {
  openrouter: [
    // Gratuits — gros contexte, optimisés JSON structuré / suivi d'instructions.
    { model: "openai/gpt-oss-120b:free", name: "GPT-OSS 120B" },
    { model: "nousresearch/hermes-3-llama-3.1-405b:free", name: "Hermes 3 405B" },
    { model: "qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen3 Next 80B" },
    { model: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B" },
    { model: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super" },
    { model: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B" },
  ],
  anthropic: [
    { model: "claude-opus-4-8", name: "Claude Opus 4.8" },
    { model: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { model: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { model: "gpt-4.1", name: "GPT-4.1" },
    { model: "gpt-4.1-mini", name: "GPT-4.1 mini" },
    { model: "gpt-4o", name: "GPT-4o" },
    { model: "gpt-4o-mini", name: "GPT-4o mini" },
    { model: "o4-mini", name: "o4-mini" },
  ],
  google: [
    { model: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { model: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { model: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    { model: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
  ],
  groq: [
    { model: "llama-3.3-70b-versatile", name: "Llama 3.3 70B (Fast)" },
    { model: "llama-3.1-8b-instant", name: "Llama 3.1 8B" },
    { model: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
  mistral: [
    { model: "open-mistral-nemo", name: "Mistral Nemo" },
    { model: "mistral-small-latest", name: "Mistral Small" },
    { model: "open-mixtral-8x22b", name: "Mixtral 8x22B" },
  ],
};

/** Ordre d'affichage des providers (OpenRouter gratuit en premier). */
export const PROVIDERS: AIProvider[] = ["openrouter", "anthropic", "openai", "google", "groq", "mistral"];

/** Tous les modèles, à plat (lookups). */
const ALL_MODELS: { provider: AIProvider; model: string; name: string }[] = PROVIDERS.flatMap(
  (p) => MODELS_BY_PROVIDER[p].map((m) => ({ provider: p, ...m })),
);

/** Modèle utilisé par défaut quand l'utilisateur n'en sélectionne aucun. */
export const DEFAULT_MODEL = "openai/gpt-oss-120b:free";

/**
 * Chaîne de fallback OpenRouter UNIQUEMENT (modèles gratuits, même clé → aucun
 * coût). Les providers payants n'ont pas de fallback (mode strict : un seul modèle).
 */
export const FALLBACK_MODELS: string[] = [
  "openai/gpt-oss-120b:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super:free",
  "openai/gpt-oss-20b:free",
];

/** Provider auquel appartient un identifiant de modèle (défaut: openrouter). */
export function providerForModel(model: string): AIProvider {
  return ALL_MODELS.find((m) => m.model === model)?.provider ?? "openrouter";
}

/** Libellé lisible d'un identifiant de modèle (pour l'UI / les toasts). */
export function getModelName(model: string): string {
  return ALL_MODELS.find((m) => m.model === model)?.name ?? model;
}
