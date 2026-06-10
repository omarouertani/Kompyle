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

  const getProviderName = useCallback((p: AIProvider) => {
    if (p === "gemini") return "Gemini";
    if (p === "groq") return "Groq";
    return "Mistral";
  }, []);

  return { provider, model, setModel, handleProviderChange, getProviderName };
}
