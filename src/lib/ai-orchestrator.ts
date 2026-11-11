import type { AIProvider } from "@/types/cv";
import { callOpenRouter, callOpenAI, callGoogle, callAnthropic, callGroq, callNvidia, ProviderHttpError } from "./ai-providers";
import { FALLBACK_MODELS, FREE_PROVIDERS, defaultModelFor, isKnownProvider, providerForModel } from "./ai-models";

/** Catégorise la raison d'échec d'un appel modèle, pour guider l'utilisateur. */
export type ProviderFailureReason =
  | "missing_key"
  | "auth"
  | "rate_limit"
  | "quota"
  | "model_unavailable"
  | "timeout"
  | "network"
  | "server"
  | "empty"
  | "unknown";

export interface ProviderFailure {
  /** Identifiant du modèle qui a échoué (ex: "claude-sonnet-5-5", "gemini-3.6-flash"). */
  model: string;
  reason: ProviderFailureReason;
  message: string;
  /** Délai conseillé avant de réessayer (secondes), quand le provider le donne (429). */
  retryAfterSeconds?: number;
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

/** Corps d'erreur signalant un modèle retiré / inconnu (souvent en 400 ou 404). */
const MODEL_GONE_PATTERNS = [
  "model_not_found",
  "model not found",
  "does not exist",
  "decommissioned",
  "deprecated",
  "no longer available",
  "no longer supported",
  "has been retired",
  "no endpoints found",
  "is not found",
  "unknown model",
  "invalid model",
  "not a valid model",
];

/** Corps d'erreur signalant un manque de crédit (à distinguer d'une limite de débit). */
const BILLING_PATTERNS = ["insufficient_quota", "billing", "credit balance", "insufficient credit", "payment required", "out of credits"];

function classifyHttpError(model: string, err: ProviderHttpError): ProviderFailure {
  const { status, message, retryAfterSeconds } = err;
  const body = err.body.toLowerCase();
  const base = { model, message, ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}) };

  if (status === 401 || status === 403) return { ...base, reason: "auth" };
  if (status === 402) return { ...base, reason: "quota" };
  if (status === 404 || status === 410) return { ...base, reason: "model_unavailable" };
  if (status === 429) {
    // OpenAI renvoie 429 + "insufficient_quota" quand le solde est épuisé.
    return { ...base, reason: BILLING_PATTERNS.some((p) => body.includes(p)) ? "quota" : "rate_limit" };
  }
  if (status === 408 || status === 504) return { ...base, reason: "timeout" };
  if (status >= 500) return { ...base, reason: "server" };
  if ((status === 400 || status === 422) && MODEL_GONE_PATTERNS.some((p) => body.includes(p))) {
    return { ...base, reason: "model_unavailable" };
  }
  if (BILLING_PATTERNS.some((p) => body.includes(p))) return { ...base, reason: "quota" };
  if (body.includes("api key not valid") || body.includes("invalid api key") || body.includes("api_key_invalid")) {
    return { ...base, reason: "auth" };
  }
  return { ...base, reason: "unknown" };
}

/** Catégorise un échec : d'abord le status HTTP (fiable), sinon le message. */
export function classifyFailure(model: string, err: unknown): ProviderFailure {
  if (err instanceof ProviderHttpError) return classifyHttpError(model, err);

  const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
  const lower = msg.toLowerCase();

  if (lower.includes("api key is not set")) return { model, reason: "missing_key", message: msg };
  if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("aborted")) {
    return { model, reason: "timeout", message: msg };
  }
  if (lower.includes("fetch failed") || lower.includes("network") || lower.includes("enotfound") || lower.includes("econnreset") || lower.includes("econnrefused")) {
    return { model, reason: "network", message: msg };
  }
  if (lower.includes("empty response")) return { model, reason: "empty", message: msg };
  return { model, reason: "unknown", message: msg };
}

/**
 * Raisons qui valent pour TOUTE la clé (pas seulement ce modèle) : inutile
 * d'essayer les modèles suivants avec la même clé.
 */
const KEY_WIDE_REASONS: ReadonlySet<ProviderFailureReason> = new Set(["missing_key", "auth", "quota"]);

async function dispatch(
  provider: AIProvider,
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number,
  apiKey?: string
): Promise<string> {
  switch (provider) {
    case "google":
      return callGoogle(systemPrompt, userPrompt, model, temperature, apiKey);
    case "groq":
      return callGroq(systemPrompt, userPrompt, model, temperature, apiKey);
    case "nvidia":
      return callNvidia(systemPrompt, userPrompt, model, temperature, apiKey);
    case "anthropic":
      return callAnthropic(systemPrompt, userPrompt, model, apiKey);
    case "openai":
      return callOpenAI(systemPrompt, userPrompt, model, apiKey);
    case "openrouter":
      return callOpenRouter(systemPrompt, userPrompt, model, temperature, apiKey);
  }
}

export interface CallWithFallbackOptions {
  /** Provider choisi. Une valeur inconnue (ex. ancien "mistral") est refusée proprement. */
  provider: AIProvider | string;
  model?: string;
  /** Clé API du provider (BYOK). Pour OpenRouter, env peut servir de fallback. */
  apiKey?: string;
  /** Température. Bas (0–0.1) = extraction factuelle (ATS) ; défaut 0.3. */
  temperature?: number;
}

/**
 * Appelle le provider/modèle choisi.
 * - Providers gratuits (Gemini, Groq, OpenRouter, NVIDIA) : secours entre les
 *   modèles du MÊME provider (même clé, aucun coût), arrêté dès qu'une erreur
 *   concerne toute la clé (clé absente / invalide, crédit épuisé).
 * - Anthropic / OpenAI (payants) : STRICT, uniquement le modèle choisi.
 * - Jamais de bascule vers un autre provider (le CV ne part pas chez un tiers).
 */
export async function callWithFallback(
  systemPrompt: string,
  userPrompt: string,
  opts: CallWithFallbackOptions
): Promise<CallWithFallbackResult> {
  const { apiKey } = opts;
  const temperature = opts.temperature ?? 0.3;

  if (!isKnownProvider(opts.provider)) {
    throw new AllProvidersFailedError([
      {
        model: opts.model || `(${String(opts.provider)})`,
        reason: "model_unavailable",
        message: `Provider "${String(opts.provider)}" is no longer supported. Pick another provider.`,
      },
    ]);
  }
  const provider: AIProvider = opts.provider;
  const chosenModel = opts.model || defaultModelFor(provider);

  const modelsToTry: string[] = [chosenModel];
  if (FREE_PROVIDERS.has(provider)) {
    for (const m of FALLBACK_MODELS[provider]) {
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
      if (KEY_WIDE_REASONS.has(f.reason)) break;
    }
  }

  throw new AllProvidersFailedError(failures);
}

/** Provider d'un modèle — réexport pratique pour les routes/UI. */
export { providerForModel };
