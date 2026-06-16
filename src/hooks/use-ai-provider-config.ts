"use client";

import { useState, useCallback } from "react";
import type { AIProvider } from "@/types/cv";
import { MODELS_BY_PROVIDER, DEFAULT_MODEL, getModelName, providerForModel } from "@/lib/ai-models";

export { getModelName, DEFAULT_MODEL, providerForModel };

/** Modèles regroupés par provider pour le sélecteur (4 groupes). */
export const PROVIDER_MODELS = MODELS_BY_PROVIDER;

/** Métadonnées d'affichage par provider (libellé + pastille de marque). */
export const PROVIDER_META: Record<AIProvider, { label: string; color: string }> = {
  openrouter: { label: "OpenRouter (gratuit)", color: "#6566f1" },
  anthropic: { label: "Anthropic Claude", color: "#d97757" },
  openai: { label: "OpenAI", color: "#10a37f" },
  google: { label: "Google Gemini", color: "#4285f4" },
};

export function useAIProviderConfig() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const provider = providerForModel(model);

  /** Sélectionne un modèle (le provider en découle). */
  const selectModel = useCallback((modelId: string) => {
    setModel(modelId);
  }, []);

  const getProviderName = useCallback((p: AIProvider) => PROVIDER_META[p].label, []);

  return { provider, model, setModel, selectModel, getProviderName };
}
