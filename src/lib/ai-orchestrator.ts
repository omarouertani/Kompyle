import type { AIProvider } from "@/types/cv";
import { callGemini, callGroq, callMistral } from "./ai-providers";

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-large-2512",
};

export interface CallWithFallbackResult {
  text: string;
  provider: AIProvider;
}

export async function callWithFallback(
  systemPrompt: string,
  userPrompt: string,
  preferredProvider: AIProvider = "gemini",
  model?: string
): Promise<CallWithFallbackResult> {
  const providersToTry: AIProvider[] = [preferredProvider];
  for (const p of ["gemini", "groq", "mistral"] as AIProvider[]) {
    if (!providersToTry.includes(p)) providersToTry.push(p);
  }

  let lastError: unknown = null;

  for (const p of providersToTry) {
    try {
      const modelToUse = (p === preferredProvider && model) ? model : DEFAULT_MODELS[p];
      let text: string;

      if (p === "groq") {
        text = await callGroq(systemPrompt, userPrompt, modelToUse);
      } else if (p === "mistral") {
        text = await callMistral(systemPrompt, userPrompt, modelToUse);
      } else {
        text = await callGemini(systemPrompt, userPrompt, modelToUse);
      }

      return { text, provider: p };
    } catch (err) {
      console.warn(`Provider ${p} failed, trying next fallback...`, err);
      lastError = err;
    }
  }

  throw new Error(
    `All AI providers failed. Last error: ${lastError instanceof Error ? lastError.message : "Unknown error"}`
  );
}
