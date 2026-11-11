"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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

/** Modèles regroupés par provider pour le sélecteur (un groupe par provider). */
export const PROVIDER_MODELS = MODELS_BY_PROVIDER;

/** Métadonnées d'affichage par provider (libellé + pastille de marque + offre gratuite). */
export const PROVIDER_META: Record<AIProvider, { label: string; color: string; free: boolean }> = {
  google: { label: "Google Gemini", color: "#4285f4", free: true },
  groq: { label: "Groq", color: "#f55036", free: true },
  openrouter: { label: "OpenRouter", color: "#6566f1", free: true },
  nvidia: { label: "NVIDIA NIM", color: "#76b900", free: true },
  anthropic: { label: "Anthropic Claude", color: "#d97757", free: false },
  openai: { label: "OpenAI", color: "#10a37f", free: false },
};

export function useAIProviderConfig() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const provider = providerForModel(model);
  const tErr = useTranslations("AIErrors");

  // Restaure le dernier modèle choisi (après hydratation, côté client). Une
  // valeur stockée qui ne correspond plus à aucun modèle du catalogue (modèle
  // ou provider retiré, ex. Mistral) est oubliée : on garde le modèle par
  // défaut et on prévient l'utilisateur, sans planter.
  // A lazy useState initialiser cannot be used: localStorage does not exist
  // during SSR and the first client render must match the server HTML. The
  // one-off restore after mount is the intended effect here.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(MODEL_KEY);
      if (!stored) return;
      if (KNOWN_MODELS.has(stored)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off restore from localStorage after hydration
        setModel(stored);
        return;
      }
      // Différé : le <Toaster> du layout s'abonne dans son propre effet, qui
      // s'exécute APRÈS celui-ci au premier rendu (un toast émis avant serait
      // perdu). Le nettoyage du stockage est fait dans le même rappel pour que
      // le double montage du mode strict n'efface pas la valeur sans prévenir.
      const timer = window.setTimeout(() => {
        try { localStorage.removeItem(MODEL_KEY); } catch { /* stockage indisponible */ }
        toast.info(tErr("model_reset", { model: getModelName(DEFAULT_MODEL) }));
      }, 0);
      return () => window.clearTimeout(timer);
    } catch {
      // stockage indisponible — on garde le modèle par défaut
    }
  }, [tErr]);

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
