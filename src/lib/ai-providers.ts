import { DEFAULT_MODEL } from "./ai-models";

// ─── Clients provider (BYOK) ──────────────────────────────────────────────────
// Signature commune : (system, user, model, temperature, apiKey) => Promise<string>.
// Chaque client inclut le status HTTP + le corps d'erreur dans l'Error lancée pour
// que `classifyFailure` (orchestrateur) catégorise (401 auth, 429 rate limit,
// 402/insufficient_quota/credit = plus d'argent, …).

/** OpenRouter — API compatible OpenAI, modèles gratuits. Clé user ou env fallback. */
export async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  model: string = DEFAULT_MODEL,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set (add your OpenRouter API key).");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_SITE_NAME) headers["X-Title"] = process.env.OPENROUTER_SITE_NAME;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned an empty response.");
  return text;
}

/** OpenAI — Chat Completions, JSON mode. */
export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key is not set (add your OpenAI API key).");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned an empty response.");
  return text;
}

/** Groq — API compatible OpenAI, inférence rapide. JSON mode. */
export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("Groq API key is not set (add your Groq API key).");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

/** Mistral — Chat Completions, compatible OpenAI. JSON mode. */
export async function callMistral(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
  apiKey?: string
): Promise<string> {
  if (!apiKey) throw new Error("Mistral API key is not set (add your Mistral API key).");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Mistral returned an empty response.");
  return text;
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Google returned an empty response.");
  return text;
}

/** Anthropic Claude — Messages API. Les prompts imposent déjà "JSON only". */
export async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  temperature: number = 0.3,
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
      max_tokens: 8192,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const text = Array.isArray(data.content)
    ? data.content.map((b: { text?: string }) => b.text ?? "").join("")
    : "";
  if (!text) throw new Error("Anthropic returned an empty response.");
  return text;
}
