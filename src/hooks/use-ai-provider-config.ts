"use client";

import { useState, useCallback, useEffect } from "react";
import type { AIProvider } from "@/types/cv";
import { MODELS_BY_PROVIDER, DEFAULT_MODEL, getModelName, providerForModel } from "@/lib/ai-models";

/** Clé localStorage : dernier modèle IA choisi, restauré au rechargement
 *  (avant, le choix retombait toujours sur le modèle par défaut). */
const MODEL_KEY = "kompyle_ai_model";

/** Ensemble des IDs de modèles connus — pour ignorer une valeur stockée obsolète. */
const KNOWN_MODELS = new Set(
  Object.values(MODELS_BY_PROVIDER).flatMap((list) => list.map((m) => m.model)),
);

export { getModelName, DEFAULT_MODEL, providerForModel };

/** Modèles regroupés par provider pour le sélecteur (4 groupes). */
export const PROVIDER_MODELS = MODELS_BY_PROVIDER;

/** Métadonnées d'affichage par provider (libellé + pastille de marque). */
export const PROVIDER_META: Record<AIProvider, { label: string; color: string }> = {
  openrouter: { label: "OpenRouter (gratuit)", color: "#6566f1" },
  anthropic: { label: "Anthropic Claude", color: "#d97757" },
  openai: { label: "OpenAI", color: "#10a37f" },
  google: { label: "Google Gemini", color: "#4285f4" },
  groq: { label: "Groq", color: "#f55036" },
  mistral: { label: "Mistral", color: "#fa5208" },
};

export function useAIProviderConfig() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const provider = providerForModel(model);

  // Restaure le dernier modèle choisi (après hydratation, côté client). On ignore
  // une valeur stockée qui ne correspond plus à aucun modèle du catalogue.
  // A lazy useState initialiser cannot be used: localStorage does not exist
  // during SSR and the first client render must match the server HTML. The
  // one-off restore after mount is the intended effect here.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODEL_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from localStorage after hydration
      if (stored && KNOWN_MODELS.has(stored)) setModel(stored);
    } catch {
      // stockage indisponible — on garde le modèle par défaut
    }
  }, []);

  /** Sélectionne un modèle (le provider en découle) et persiste le choix. */
  const selectModel = useCallback((modelId: string) => {
    setModel(modelId);
    try {
      localStorage.setItem(MODEL_KEY, modelId);
    } catch {
      // stockage indisponible — sélection en mémoire uniquement
    }
  }, []);

  const getProviderName = useCallback((p: AIProvider) => PROVIDER_META[p].label, []);

  return { provider, model, setModel, selectModel, getProviderName };
}
