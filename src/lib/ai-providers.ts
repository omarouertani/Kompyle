import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

export async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string = "gemini-2.5-flash"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment variables.");

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

export async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string = "llama-3.3-70b-versatile"
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in environment variables.");

  const groq = new Groq({ apiKey });

  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
    max_tokens: 4096,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

export async function callMistral(
  systemPrompt: string,
  userPrompt: string,
  model: string = "mistral-large-2512"
): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) throw new Error("MISTRAL_API_KEY is not set in environment variables.");

  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
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
