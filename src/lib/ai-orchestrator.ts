import type { AIProvider } from "@/types/cv";
import { callGemini, callGroq, callMistral } from "./ai-providers";

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  mistral: "mistral-large-2512",
};

/** Catégorise la raison d'échec d'un appel provider, pour pouvoir guider
 *  l'utilisateur (clé API manquante, quota épuisé, panne, …). */
export type ProviderFailureReason =
  | "missing_key"
  | "auth"
  | "rate_limit"
  | "quota"
  | "timeout"
  | "network"
  | "server"
  | "empty"
  | "unknown";

export interface ProviderFailure {
  provider: AIProvider;
  reason: ProviderFailureReason;
  message: string;
}

export interface CallWithFallbackResult {
  text: string;
  provider: AIProvider;
  /** Providers tentés et tombés en panne avant celui qui a réussi (ordre chronologique). */
  failures: ProviderFailure[];
}

/** Erreur enrichie : on connaît PRÉCISÉMENT pourquoi chaque provider a planté. */
export class AllProvidersFailedError extends Error {
  failures: ProviderFailure[];
  constructor(failures: ProviderFailure[]) {
    super(
      failures.length === 0
        ? "All AI providers failed."
        : `All AI providers failed — ${failures.map((f) => `${f.provider}: ${f.reason}`).join(" · ")}`,
    );
    this.name = "AllProvidersFailedError";
    this.failures = failures;
  }
}

function classifyFailure(provider: AIProvider, err: unknown): ProviderFailure {
  const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const lower = msg.toLowerCase();

  if (lower.includes("api_key") || lower.includes("api key") || lower.includes("not set in environment")) {
    return { provider, reason: "missing_key", message: msg };
  }
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("invalid api key") || lower.includes("authentication")) {
    return { provider, reason: "auth", message: msg };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    return { provider, reason: "rate_limit", message: msg };
  }
  if (lower.includes("quota") || lower.includes("billing") || lower.includes("exceeded") || lower.includes("insufficient_quota")) {
    return { provider, reason: "quota", message: msg };
  }
  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("abort")) {
    return { provider, reason: "timeout", message: msg };
  }
  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnreset")) {
    return { provider, reason: "network", message: msg };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504")) {
    return { provider, reason: "server", message: msg };
  }
  if (lower.includes("empty response")) {
    return { provider, reason: "empty", message: msg };
  }
  return { provider, reason: "unknown", message: msg };
}

export interface CallWithFallbackOptions {
  /** Température transmise à tous les providers. Bas (0–0.1) = extraction factuelle
   *  déterministe (ATS) ; plus haut = plus de créativité (rédaction). Défaut 0.3. */
  temperature?: number;
}

export async function callWithFallback(
  systemPrompt: string,
  userPrompt: string,
  preferredProvider: AIProvider = "gemini",
  model?: string,
  options?: CallWithFallbackOptions
): Promise<CallWithFallbackResult> {
  const temperature = options?.temperature ?? 0.3;
  const providersToTry: AIProvider[] = [preferredProvider];
  for (const p of ["gemini", "groq", "mistral"] as AIProvider[]) {
    if (!providersToTry.includes(p)) providersToTry.push(p);
  }

  const failures: ProviderFailure[] = [];

  for (const p of providersToTry) {
    try {
      const modelToUse = (p === preferredProvider && model) ? model : DEFAULT_MODELS[p];
      let text: string;

      if (p === "groq") {
        text = await callGroq(systemPrompt, userPrompt, modelToUse, temperature);
      } else if (p === "mistral") {
        text = await callMistral(systemPrompt, userPrompt, modelToUse, temperature);
      } else {
        text = await callGemini(systemPrompt, userPrompt, modelToUse, temperature);
      }

      return { text, provider: p, failures };
    } catch (err) {
      const f = classifyFailure(p, err);
      console.warn(`Provider ${p} failed (${f.reason}):`, f.message);
      failures.push(f);
    }
  }

  throw new AllProvidersFailedError(failures);
}
