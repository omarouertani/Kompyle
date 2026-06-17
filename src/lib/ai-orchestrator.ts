import type { AIProvider } from "@/types/cv";
import { callOpenRouter, callOpenAI, callGoogle, callAnthropic, callGroq, callMistral } from "./ai-providers";
import { DEFAULT_MODEL, FALLBACK_MODELS, providerForModel } from "./ai-models";

/** Catégorise la raison d'échec d'un appel modèle, pour guider l'utilisateur. */
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
  /** Identifiant du modèle qui a échoué (ex: "claude-opus-4-8", "openai/gpt-oss-120b:free"). */
  model: string;
  reason: ProviderFailureReason;
  message: string;
}

export interface CallWithFallbackResult {
  text: string;
  provider: AIProvider;
  /** Modèle qui a effectivement répondu. */
  model: string;
  failures: ProviderFailure[];
}

/** Erreur enrichie : on connaît PRÉCISÉMENT pourquoi chaque modèle a planté. */
export class AllProvidersFailedError extends Error {
  failures: ProviderFailure[];
  constructor(failures: ProviderFailure[]) {
    super(
      failures.length === 0
        ? "All AI models failed."
        : `All AI models failed — ${failures.map((f) => `${f.model}: ${f.reason}`).join(" · ")}`,
    );
    this.name = "AllProvidersFailedError";
    this.failures = failures;
  }
}

function classifyFailure(model: string, err: unknown): ProviderFailure {
  const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const lower = msg.toLowerCase();

  if (lower.includes("api key is not set") || lower.includes("api_key") || lower.includes("not set")) {
    return { model, reason: "missing_key", message: msg };
  }
  if (lower.includes("401") || lower.includes("403") || lower.includes("unauthorized") || lower.includes("unauthenticated") || lower.includes("invalid api key") || lower.includes("api key not valid") || lower.includes("api_key_invalid") || lower.includes("invalid x-api-key") || lower.includes("authentication") || lower.includes("permission")) {
    return { model, reason: "auth", message: msg };
  }
  // Plus de crédit / facturation : à distinguer AVANT le rate limit générique
  // (OpenAI renvoie 429 + "insufficient_quota" quand le solde est épuisé).
  if (lower.includes("402") || lower.includes("payment required") || lower.includes("insufficient_quota") || lower.includes("quota") || lower.includes("billing") || lower.includes("credit") || lower.includes("balance") || lower.includes("exceeded your current quota")) {
    return { model, reason: "quota", message: msg };
  }
  if (lower.includes("429") || lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("resource_exhausted") || lower.includes("resource exhausted")) {
    return { model, reason: "rate_limit", message: msg };
  }
  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("abort")) {
    return { model, reason: "timeout", message: msg };
  }
  if (lower.includes("network") || lower.includes("fetch failed") || lower.includes("enotfound") || lower.includes("econnreset")) {
    return { model, reason: "network", message: msg };
  }
  if (lower.includes("500") || lower.includes("502") || lower.includes("503") || lower.includes("504") || lower.includes("overloaded")) {
    return { model, reason: "server", message: msg };
  }
  if (lower.includes("empty response")) {
    return { model, reason: "empty", message: msg };
  }
  return { model, reason: "unknown", message: msg };
}

async function dispatch(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
  apiKey?: string
): Promise<string> {
  switch (provider) {
    case "openai":
      return callOpenAI(systemPrompt, userPrompt, model, temperature, apiKey);
    case "google":
      return callGoogle(systemPrompt, userPrompt, model, temperature, apiKey);
    case "anthropic":
      return callAnthropic(systemPrompt, userPrompt, model, temperature, apiKey);
    case "groq":
      return callGroq(systemPrompt, userPrompt, model, temperature, apiKey);
    case "mistral":
      return callMistral(systemPrompt, userPrompt, model, temperature, apiKey);
    case "openrouter":
    default:
      return callOpenRouter(systemPrompt, userPrompt, model, temperature, apiKey);
  }
}

export interface CallWithFallbackOptions {
  provider: AIProvider;
  model?: string;
  /** Clé API du provider (BYOK). Pour OpenRouter, env peut servir de fallback. */
  apiKey?: string;
  /** Température. Bas (0–0.1) = extraction factuelle (ATS) ; défaut 0.3. */
  temperature?: number;
}

/**
 * Appelle le provider/modèle choisi.
 * - OpenRouter (gratuit) : fallback inter-modèles (modèle choisi → FALLBACK_MODELS).
 * - Google / OpenAI / Anthropic (payant) : STRICT, uniquement le modèle choisi
 *   (pas de changement automatique → aucun coût surprise).
 */
export async function callWithFallback(
  systemPrompt: string,
  userPrompt: string,
  opts: CallWithFallbackOptions
): Promise<CallWithFallbackResult> {
  const { provider, apiKey } = opts;
  const temperature = opts.temperature ?? 0.3;
  const chosenModel = opts.model || (provider === "openrouter" ? DEFAULT_MODEL : undefined);

  if (!chosenModel) {
    throw new AllProvidersFailedError([
      { model: `(${provider})`, reason: "unknown", message: "No model selected." },
    ]);
  }

  // OpenRouter free → chaîne de fallback ; payant → modèle unique (strict).
  const modelsToTry: string[] = [chosenModel];
  if (provider === "openrouter") {
    for (const m of FALLBACK_MODELS) {
      if (!modelsToTry.includes(m)) modelsToTry.push(m);
    }
  }

  const failures: ProviderFailure[] = [];

  for (const model of modelsToTry) {
    const startedAt = Date.now();
    try {
      const text = await dispatch(provider, systemPrompt, userPrompt, model, temperature, apiKey);
      console.info(`[ai] ${provider}/${model} OK in ${Date.now() - startedAt}ms (${text.length} chars)`);
      return { text, provider, model, failures };
    } catch (err) {
      const f = classifyFailure(model, err);
      console.warn(`[ai] ${provider}/${model} failed (${f.reason}) after ${Date.now() - startedAt}ms:`, f.message);
      failures.push(f);
    }
  }

  throw new AllProvidersFailedError(failures);
}

/** Provider d'un modèle — réexport pratique pour les routes/UI. */
export { providerForModel };
