"use client";

import { useState, useCallback } from "react";
import type { AIProvider } from "@/types/cv";

export const PROVIDER_MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { id: "llama3-70b-8192", name: "Llama 3 70B" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
  mistral: [
    { id: "mistral-large-2512", name: "Mistral Large" },
    { id: "mistral-small-2603", name: "Mistral Small" },
    { id: "ministral-8b-2512", name: "Ministral 8B" },
  ],
};

/** Métadonnées d'affichage par fournisseur (libellé + pastille de marque). */
export const PROVIDER_META: Record<AIProvider, { label: string; color: string }> = {
  gemini: { label: "Google Gemini", color: "#4285f4" },
  groq: { label: "Groq", color: "#f55036" },
  mistral: { label: "Mistral AI", color: "#fa520f" },
};

/** Retrouve le fournisseur auquel appartient un identifiant de modèle. */
export function providerForModel(modelId: string): AIProvider {
  for (const p of Object.keys(PROVIDER_MODELS) as AIProvider[]) {
    if (PROVIDER_MODELS[p].some((m) => m.id === modelId)) return p;
  }
  return "gemini";
}

export function useAIProviderConfig() {
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [model, setModel] = useState<string>("gemini-2.5-flash");

  const handleProviderChange = useCallback((newProvider: AIProvider) => {
    setProvider(newProvider);
    if (newProvider === "gemini") {
      setModel("gemini-2.5-flash");
    } else if (newProvider === "groq") {
      setModel("llama-3.3-70b-versatile");
    } else if (newProvider === "mistral") {
      setModel("mistral-large-2512");
    }
  }, []);

  /** Sélectionne un modèle et synchronise le fournisseur correspondant. */
  const selectModel = useCallback((modelId: string) => {
    setProvider(providerForModel(modelId));
    setModel(modelId);
  }, []);

  const getProviderName = useCallback((p: AIProvider) => {
    if (p === "gemini") return "Gemini";
    if (p === "groq") return "Groq";
    return "Mistral";
  }, []);

  return { provider, model, setModel, selectModel, handleProviderChange, getProviderName };
}
