import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import type { GenerateCoverLetterRequest, CoverLetterData, AIProvider } from "@/types/cv";

const SYSTEM_PROMPT = `Tu es un expert en recrutement de haut niveau. 
Ta mission est de rédiger une lettre de motivation (Cover Letter) professionnelle et percutante en te basant sur le CV du candidat et la description de l'offre d'emploi.

Règles de rédaction (CRITICAL) :
1. Le ton doit être professionnel, persuasif, et direct (pas de remplissage inutile).
2. Utilise une structure classique : 
   - Paragraphe 1 : L'accroche (pourquoi cette entreprise, quel poste).
   - Paragraphe 2 : L'adéquation (comment les expériences du CV répondent aux besoins de l'offre).
   - Paragraphe 3 : La projection (ce que le candidat va apporter).
   - Paragraphe 4 : La conclusion/appel à l'action (disponibilité pour un entretien).
3. Adapte la langue de la lettre en fonction de la langue de l'offre d'emploi (français ou anglais).
4. La date doit être la date d'aujourd'hui (format lisible).
5. Si le nom de l'entreprise cible (recipientCompany) n'est pas explicitement dit dans l'offre, laisse le champ vide (""). N'invente pas de nom et n'utilise pas "L'entreprise".
6. Si le nom du contact (recipientName) n'est pas explicitement dit dans l'offre, laisse le champ vide (""). N'utilise pas "Responsable du Recrutement" ou "Hiring Manager".
7. L'objet (subject) doit être clair (ex: "Candidature pour le poste de...").
8. La signature (signOff) doit être professionnelle (ex: "Cordialement,", "Sincerely,").

Tu dois OBLIGATOIREMENT retourner la réponse au format JSON strictement valide, sans aucun bloc markdown ni texte avant ou après. 

Structure JSON requise :
{
  "recipientName": "string",
  "recipientCompany": "string",
  "recipientAddress": "string",
  "date": "string",
  "subject": "string",
  "salutation": "string",
  "paragraphs": ["string", "string", "string", "string"],
  "signOff": "string"
}`;

async function callGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }] }],
    config: {
      temperature: 0.5,
      responseMimeType: "application/json",
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

async function callGroq(userPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");
  const groq = new Groq({ apiKey });
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.5,
    response_format: { type: "json_object" },
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Groq returned an empty response.");
  return text;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateCoverLetterRequest;
    const { jobDescription, cvData, provider = "gemini" } = body;

    if (!jobDescription || !cvData) {
      return NextResponse.json(
        { error: "Description du poste et données du CV requises." },
        { status: 400 }
      );
    }

    const todayDate = new Date().toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const userPrompt = `
Date du jour: ${todayDate}

=== OFFRE D'EMPLOI ===
${jobDescription}

=== DONNÉES DU CV ===
${JSON.stringify(cvData, null, 2)}
    `;

    let rawResponse: string;
    let actualProvider: AIProvider = provider;

    try {
      if (provider === "groq") {
        rawResponse = await callGroq(userPrompt);
      } else {
        rawResponse = await callGemini(userPrompt);
      }
    } catch (primaryError) {
      console.warn(`Primary provider (${provider}) failed for Cover Letter, trying fallback...`, primaryError);
      try {
        if (provider === "gemini") {
          rawResponse = await callGroq(userPrompt);
          actualProvider = "groq";
        } else {
          rawResponse = await callGemini(userPrompt);
          actualProvider = "gemini";
        }
      } catch (fallbackError) {
        throw new Error("Both AI providers failed. Check your API keys.");
      }
    }

    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const coverLetterData: CoverLetterData = JSON.parse(cleaned);

    return NextResponse.json({
      coverLetter: coverLetterData,
      provider: actualProvider,
    });
  } catch (error: any) {
    console.error("Cover Letter Generation Error:", error);
    return NextResponse.json(
      {
        error: "Échec de la génération de la lettre de motivation.",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
