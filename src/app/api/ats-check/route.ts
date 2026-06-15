import { NextRequest } from "next/server";
import type { ATSCheckRequest, ATSCheckResponse } from "@/types/cv";
import { z } from "zod";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { atsReportSchema } from "@/schemas/atsSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback, AllProvidersFailedError } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";
import { calculateTotalExperience } from "@/lib/cv-analysis";

// Schéma JSON canonique injecté dans le prompt — l'IA voit la forme exacte attendue.
let ATS_SCHEMA_JSON = "";
try {
  ATS_SCHEMA_JSON = JSON.stringify(z.toJSONSchema(atsReportSchema), null, 2);
} catch {
  ATS_SCHEMA_JSON = "";
}

const SYSTEM_PROMPT = `You are an elite ATS (Applicant Tracking System) auditor. You receive a CV (JSON) and a job posting (plain text). Your job: score how well this CV would pass an ATS scan for THIS specific posting, and produce a structured, actionable report.

## How to score
- overallScore (0-100): the holistic ATS pass-likelihood for this posting. Be honest, not generous.
  * 85-100: highly competitive (most must-have keywords + all required skills covered).
  * 65-84: solid but with clear gaps to close.
  * 40-64: average — multiple key terms missing or weakly surfaced.
  * 0-39: poor fit — missing fundamentals.
- subScores (0-100 each):
  * keywords: exact-term match between job posting and CV (techLine, bullets, skills.items, summary).
  * skills: coverage of the technical skills explicitly required by the posting.
  * experience: alignment of job titles, years of experience, and seniority signals.
  * formatting: section coverage (Summary, Experience, Skills, Education, Projects...) and ATS-readability.

## Keyword extraction rules (truthful)
- matchedKeywords: terms required by the posting AND already present in the CV. Use the EXACT spelling from the job posting.
- missingKeywords: terms explicitly required by the posting and NOT found in the CV. Do not invent requirements that aren't in the posting.
- Cap each list at ~15 items; surface the most ATS-impactful first.

## Section feedback
For each major CV section (Summary, Experience, Skills, Projects, Education, Languages, Certifications when present), emit ONE entry:
- status = "good" when the section already aligns well with the posting.
- status = "warning" when the section is present but underweights important elements.
- status = "missing" when a section the posting expects is absent OR effectively empty.
Feedback must be a SHORT sentence (max ~20 words) pointing at the concrete gap or strength versus the posting. Write it in the job posting's language.

## Strengths & recommendations
- strengths: 3-6 short phrases about what this candidate brings that the posting actually asks for.
- recommendations: 4-8 atomic, imperative-mood actions to raise the score (e.g. "Add 'Kubernetes' to skills if you've used it", "Reword the summary to mention 5+ years of Java").
- Recommendations must be specific to gaps you detected — never generic platitudes.

## Output format
- Write the human-readable fields (summary, scoreLabel, sectionFeedback.feedback, strengths, recommendations) in the SAME LANGUAGE as the job posting.
- Keep keyword strings in their original language/casing (technical terms stay as-is).

## Hard constraints
1. Output ONLY one raw JSON object. No markdown fences, no commentary, no prose before or after.
2. The JSON MUST validate against this exact schema:

${ATS_SCHEMA_JSON}`;

function buildCorrectionPrompt(originalUserPrompt: string, issues: string[]): string {
  return `${originalUserPrompt}

## Your previous answer was REJECTED
It failed strict schema validation with these errors:
${issues.map((issue) => `- ${issue}`).join("\n")}

Return ONLY a corrected raw JSON object that fixes these errors and fully respects the schema and all rules above. No markdown, no commentary.`;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return Response.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000)) } }
      );
    }

    const body = (await request.json()) as ATSCheckRequest;
    const { jobDescription, cvData, provider = "gemini", model } = body;

    if (!jobDescription || typeof jobDescription !== "string" || jobDescription.trim().length < 20) {
      return Response.json(
        { error: "The job description must contain at least 20 characters." },
        { status: 400 }
      );
    }

    const inputValidation = resumeSchema.safeParse(cvData);
    if (!inputValidation.success) {
      return Response.json(
        {
          error: "The CV data is invalid or incomplete.",
          details: formatZodIssues(inputValidation.error).join(" · "),
        },
        { status: 400 }
      );
    }

    // Layout user-controlled — pas envoyé à l'IA (économie tokens + zéro intérêt analytique).
    const { layout: _layout, ...cvForAi } = cvData;

    // Expérience totale calculée en TS et IMPOSÉE à l'IA (anti-hallucination).
    const totalYears = calculateTotalExperience(cvData.experiences);

    const userPrompt = `## TARGET JOB POSTING:
${jobDescription}

## CANDIDATE'S ACTUAL EXPERIENCE (computed, DO NOT recalculate):
- Total Professional Experience: EXACTLY ${totalYears} years.
- When scoring "experience" and writing recommendations, use ONLY this number — do not infer years yourself.

## CANDIDATE'S CV (JSON):
${JSON.stringify(cvForAi, null, 2)}

## INSTRUCTIONS:
1. Extract the must-have skills, soft skills, and recurring keywords from the job posting.
2. Compare each one against the CV (summary, techLine, bullets, skills.items, projects.stack, education).
3. Score the CV honestly using the rubric in the system prompt.
4. Return ONLY the JSON report. No markdown, no prose.`;

    let result;
    try {
      result = await callWithFallback(SYSTEM_PROMPT, userPrompt, provider, model);
    } catch (err) {
      console.error("All AI providers failed (ATS check).");
      if (err instanceof AllProvidersFailedError) {
        return Response.json(
          {
            error: "All AI providers failed.",
            details: err.failures.map((f) => `${f.provider}: ${f.reason}`),
            failures: err.failures,
          },
          { status: 502 }
        );
      }
      return Response.json(
        {
          error: "All AI providers failed. Check your API keys and configuration.",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    const { text: rawResponse, provider: usedProvider } = result;

    let validation = extractAndValidate(rawResponse, atsReportSchema);

    if (!validation.success) {
      console.warn("ATS report failed validation, retrying with self-correction...", validation.issues);
      try {
        const correctionPrompt = buildCorrectionPrompt(userPrompt, validation.issues);
        const retryResult = await callWithFallback(SYSTEM_PROMPT, correctionPrompt, usedProvider, model);
        validation = extractAndValidate(retryResult.text, atsReportSchema);
      } catch (retryError) {
        console.error("Self-correction retry failed (ATS check):", retryError);
      }
    }

    if (!validation.success) {
      return Response.json(
        {
          error: "The ATS report structure is invalid.",
          details: validation.issues,
        },
        { status: 502 }
      );
    }

    const response: ATSCheckResponse = {
      report: validation.data,
      provider: usedProvider,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Unexpected error in /api/ats-check:", error);
    return Response.json(
      {
        error: "An unexpected error occurred.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
