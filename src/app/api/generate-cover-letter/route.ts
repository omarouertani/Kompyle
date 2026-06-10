import { NextRequest, NextResponse } from "next/server";
import type { GenerateCoverLetterRequest, CoverLetterData } from "@/types/cv";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { callWithFallback } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";

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

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } }
      );
    }

    const body = (await req.json()) as GenerateCoverLetterRequest;
    const { jobDescription, cvData, provider = "gemini", model } = body;

    if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 20) {
      return NextResponse.json(
        { error: "The job description must contain at least 20 characters." },
        { status: 400 }
      );
    }

    const inputValidation = resumeSchema.safeParse(cvData);
    if (!inputValidation.success) {
      return NextResponse.json(
        {
          error: "The CV data is invalid or incomplete.",
          details: formatZodIssues(inputValidation.error).join(" · "),
        },
        { status: 400 }
      );
    }

    // Strip layout before sending to AI
    const { layout: _layout, ...cvForAi } = cvData;

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
${JSON.stringify(cvForAi, null, 2)}
    `;

    const result = await callWithFallback(SYSTEM_PROMPT, userPrompt, provider, model);

    const cleaned = result.text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    const coverLetterData: CoverLetterData = JSON.parse(cleaned);

    return NextResponse.json({
      coverLetter: coverLetterData,
      provider: result.provider,
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
