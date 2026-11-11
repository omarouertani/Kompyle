import type { AIProvider } from "@/types/cv";
import { defaultModelFor } from "./ai-models";

// ─── Clients provider (BYOK) ──────────────────────────────────────────────────
// Signature commune : (system, user, model, temperature, apiKey) => Promise<string>
// (sans `temperature` pour OpenAI / Anthropic, dont les modèles actuels la refusent).
// Une réponse HTTP en erreur lève un `ProviderHttpError` (status + extrait du
// corps + Retry-After) pour que `classifyFailure` (orchestrateur) catégorise
// sans deviner : 401/403 auth, 404 modèle retiré, 429 limite, 402 crédit, …
// La clé API n'apparaît JAMAIS dans un message d'erreur ni dans une URL.

/** Taille max de l'extrait de corps d'erreur conservé (lisible, sans noyer l'UI). */
const MAX_ERROR_BODY = 600;

export class ProviderHttpError extends Error {
  readonly provider: AIProvider;
  readonly status: number;
  readonly body: string;
  /** Délai conseillé avant de réessayer (secondes), si le provider le donne. */
  readonly retryAfterSeconds?: number;

  constructor(provider: AIProvider, label: string, status: number, statusText: string, body: string, retryAfterSeconds?: number) {
    const excerpt = body.length > MAX_ERROR_BODY ? `${body.slice(0, MAX_ERROR_BODY)}…` : body;
    super(`${label} API error: ${status} ${statusText} - ${excerpt}`.trim());
    this.name = "ProviderHttpError";
    this.provider = provider;
    this.status = status;
    this.body = excerpt;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Lit l'en-tête Retry-After (secondes ou date HTTP). */
function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get("retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs);
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
}

async function toHttpError(provider: AIProvider, label: string, res: Response): Promise<ProviderHttpError> {
  let body = "";
  try {
    body = await res.text();
  } catch {
    // corps illisible : on garde le status seul
  }
  return new ProviderHttpError(provider, label, res.status, res.statusText, body, parseRetryAfter(res));
}

/** Texte d'un message Chat Completions (string, ou tableau de parts selon le provider). */
function chatContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p === "object" && typeof (p as { text?: unknown }).text === "string" ? (p as { text: string }).text : ""))
      .join("");
  }
  return "";
}

/** Vrai si une erreur 400 indique que `response_format` n'est pas accepté par ce modèle. */
function isResponseFormatRejected(err: ProviderHttpError): boolean {
  if (err.status !== 400 && err.status !== 422) return false;
  const lower = err.body.toLowerCase();
  return lower.includes("response_format") || lower.includes("json_object") || lower.includes("json mode");
}

interface OpenAICompatibleOptions {
  provider: AIProvider;
  label: string;
  url: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  /** Omis pour les modèles de raisonnement qui refusent `temperature`. */
  temperature?: number;
  /** Paramètres supplémentaires propres au provider (ex. reasoning_effort). */
  extraBody?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
}

/**
 * Appel Chat Completions compatible OpenAI (Groq, OpenRouter, NVIDIA, OpenAI).
 * Demande le mode JSON ; si ce modèle refuse `response_format` (400), on refait
 * UNE fois l'appel sans : les prompts imposent déjà « JSON only » et la sortie
 * est de toute façon extraite + validée par zod.
 */
export async function callOpenAICompatible(opts: OpenAICompatibleOptions): Promise<string> {
  const send = async (jsonMode: boolean): Promise<string> => {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.userPrompt },
      ],
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      ...opts.extraBody,
    };

    const response = await fetch(opts.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
        ...opts.extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw await toHttpError(opts.provider, opts.label, response);

    const data = await response.json();
    const text = chatContentText(data?.choices?.[0]?.message?.content);
    if (!text) throw new Error(`${opts.label} returned an empty response.`);
    return text;
  };

  try {
    return await send(true);
  } catch (err) {
    if (err instanceof ProviderHttpError && isResponseFormatRejected(err)) {
      console.warn(`[ai] ${opts.label}/${opts.model} rejected response_format, retrying without JSON mode.`);
      return send(false);
    }
    throw err;
  }
}

/** OpenRouter — modèles gratuits `:free`. Clé user, ou env en secours (dev local). */
export async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string = defaultModelFor("openrouter"),
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set (add your OpenRouter API key).");

  const extraHeaders: Record<string, string> = {};
  if (process.env.OPENROUTER_SITE_URL) extraHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_SITE_NAME) extraHeaders["X-Title"] = process.env.OPENROUTER_SITE_NAME;

  return callOpenAICompatible({
    provider: "openrouter",
    label: "OpenRouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: key,
    model,
    systemPrompt,
    userPrompt,
    temperature,
    extraHeaders,
  });
}

/** Groq — API compatible OpenAI, offre gratuite. JSON mode sur tous les modèles. */
export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("Groq API key is not set (add your Groq API key).");
  return callOpenAICompatible({
    provider: "groq",
    label: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature,
  });
}

/** NVIDIA NIM (build.nvidia.com) — API compatible OpenAI, accès gratuit de prototypage. */
export async function callNvidia(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("NVIDIA API key is not set (add your NVIDIA API key).");
  return callOpenAICompatible({
    provider: "nvidia",
    label: "NVIDIA",
    url: "https://integrate.api.nvidia.com/v1/chat/completions",
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    temperature,
    // Les réponses d'un CV complet sont longues : on évite la coupure par défaut.
    extraBody: { max_tokens: 16384 },
  });
}

/**
 * OpenAI — Chat Completions, JSON mode. Les modèles GPT-6 sont des modèles de
 * raisonnement : la doc ne garantit pas `temperature` → on l'omet et on fixe
 * un effort de raisonnement bas (réponse plus rapide, coût réduit).
 */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key is not set (add your OpenAI API key).");
  return callOpenAICompatible({
    provider: "openai",
    label: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    extraBody: { reasoning_effort: "low" },
  });
}

/** Google Gemini — generateContent REST, sortie JSON forcée. */
export async function callGoogle(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("Google Gemini API key is not set (add your Gemini API key).");

  // Clé en en-tête (pas dans l'URL) : elle ne peut pas fuiter dans un log d'URL.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) throw await toHttpError("google", "Google", response);

  const data = await response.json();
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) throw new Error(`Google blocked the request (${blockReason}).`);

  // Les parts « thought » (résumés de réflexion) ne font pas partie de la réponse.
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Google returned an empty response.");
  return text;
}

/**
 * Anthropic Claude — Messages API. Les modèles Claude 5.5 refusent `temperature`
 * (400) et réfléchissent par défaut : on omet `temperature`, on fixe l'effort et
 * on ne garde que les blocs `text`. Les prompts imposent déjà « JSON only ».
 */
export async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("Anthropic API key is not set (add your Claude API key).");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) throw await toHttpError("anthropic", "Anthropic", response);

  const data = await response.json();
  if (data?.stop_reason === "refusal") {
    throw new Error("Anthropic declined the request (refusal).");
  }
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type?: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text ?? "")
        .join("")
    : "";
  if (!text) throw new Error("Anthropic returned an empty response.");
  return text;
}
