import { NextRequest, NextResponse } from "next/server";
import type { GenerateCoverLetterRequest } from "@/types/cv";
import { z } from "zod";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { coverLetterSchema } from "@/schemas/coverLetterSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback, AllProvidersFailedError, providerForModel } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";
import { cvForAiPrompt } from "@/lib/cv-payload";

let COVER_LETTER_SCHEMA_JSON = "";
try {
  COVER_LETTER_SCHEMA_JSON = JSON.stringify(z.toJSONSchema(coverLetterSchema), null, 2);
} catch {
  COVER_LETTER_SCHEMA_JSON = "";
}

const SYSTEM_PROMPT = `You are an elite recruiter and professional cover-letter writer. Write a compelling, professional cover letter based on the candidate's CV and the target job posting.

## Truthfulness (CRITICAL — anti-hallucination)
1. Use ONLY facts present in the CV. Never invent experiences, skills, diplomas, metrics, or achievements.
2. If the company name (recipientCompany) is not explicitly stated in the job posting, leave it EMPTY (""). Never invent a name, never use "L'entreprise" or "The company".
3. If the contact name (recipientName) is not explicitly stated, leave it EMPTY (""). Never use "Responsable du Recrutement" or "Hiring Manager" as a name.
4. Same for recipientAddress: empty ("") unless explicitly in the posting.

## Writing rules
1. Professional, persuasive, direct tone — zero filler.
2. Classic structure (one paragraph each):
   - Hook: why this company, which position.
   - Fit: how the CV's experiences answer the posting's needs (cite concrete CV facts).
   - Projection: what the candidate will bring.
   - Call to action: availability for an interview.
3. Write the letter in the LANGUAGE OF THE JOB POSTING (French posting → French letter; English → English). Date, subject, salutation and signOff must all match that language.
4. Use the provided today's date, formatted naturally in the letter's language.
5. The subject must be specific (e.g. "Candidature pour le poste de…" / "Application for the … position").
6. signOff must be professional (e.g. "Cordialement,", "Sincerely,").

## Output contract
- Return ONLY one raw JSON object — no markdown fences, no comments, no prose before or after.
- It MUST validate against this exact JSON schema:

${COVER_LETTER_SCHEMA_JSON}`;

function buildCorrectionPrompt(originalUserPrompt: string, issues: string[]): string {
  return `${originalUserPrompt}

## Your previous answer was REJECTED
It failed strict schema validation with these errors:
${issues.map((issue) => `- ${issue}`).join("\n")}

Return ONLY a corrected raw JSON object that fixes these errors and fully respects the schema and all rules above. No markdown, no commentary.`;
}

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
    const { jobDescription, cvData, model, apiKey } = body;
    const provider = body.provider ?? providerForModel(model ?? "");

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

    // Layout + photo retirés avant l'envoi à l'IA (inutiles, gonflent le contexte).
    const cvForAi = cvForAiPrompt(cvData);

    // Date fournie dans les deux langues : le modèle choisit celle de l'offre.
    const today = new Date();
    const todayFr = today.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
    const todayEn = today.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const userPrompt = `Today's date — French format: ${todayFr} · English format: ${todayEn}

=== JOB POSTING ===
${jobDescription}

=== CANDIDATE'S CV (JSON) ===
${JSON.stringify(cvForAi, null, 2)}

Write the cover letter in the language of the job posting. Return only the JSON object.`;

    let result;
    try {
      result = await callWithFallback(SYSTEM_PROMPT, userPrompt, { provider, model, apiKey });
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        return NextResponse.json(
          {
            error: "All AI models failed.",
            details: err.failures.map((f) => `${f.model}: ${f.reason}`),
            failures: err.failures,
          },
          { status: 502 }
        );
      }
      return NextResponse.json(
        {
          error: "All AI models failed. Check your API key and configuration.",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    const { text: rawResponse, model: usedModel } = result;

    // Extract + repair + validate avec self-healing retry (même pipeline que /api/adapt-cv)
    let validation = extractAndValidate(rawResponse, coverLetterSchema);

    if (!validation.success) {
      console.warn("Cover letter failed validation, retrying with self-correction...", validation.issues);
      try {
        const correctionPrompt = buildCorrectionPrompt(userPrompt, validation.issues);
        const retryResult = await callWithFallback(SYSTEM_PROMPT, correctionPrompt, { provider, model: usedModel, apiKey });
        validation = extractAndValidate(retryResult.text, coverLetterSchema);
      } catch (retryError) {
        console.error("Self-correction retry failed:", retryError);
      }
    }

    if (!validation.success) {
      return NextResponse.json(
        { error: "The generated cover letter structure is invalid.", details: validation.issues },
        { status: 502 }
      );
    }

    return NextResponse.json({
      coverLetter: validation.data,
      provider,
      model: usedModel,
    });
  } catch (error) {
    console.error("Cover Letter Generation Error:", error);
    return NextResponse.json(
      {
        error: "Échec de la génération de la lettre de motivation.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
