import { NextRequest } from "next/server";
import type { ATSCheckRequest, ATSCheckResponse } from "@/types/cv";
import { z } from "zod";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { atsReportSchema } from "@/schemas/atsSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback, AllProvidersFailedError, providerForModel } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";
import { describeExperienceForPrompt } from "@/lib/cv-analysis";
import { cvForAiPrompt, buildAtsKeywordSurface } from "@/lib/cv-payload";
import { reconcileAtsKeywords } from "@/lib/ats-keyword-verifier";

// Température très basse : l'ATS doit extraire des faits (présence/absence de
// mots-clés) de façon déterministe, jamais "créer". 0 = sortie reproductible.
const ATS_TEMPERATURE = 0;

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

## ABSOLUTE RULE — EXHAUSTIVE SCAN (read this first, it overrides your instincts)
You suffer from "Lost in the Middle": you tend to overlook skills buried in nested arrays and declare them MISSING when they are actually PRESENT. This is a critical failure. To prevent it, obey these non-negotiable rules:
1. Before classifying ANY term as missing, you MUST scan EVERY field of the CV JSON, including deeply nested arrays. A keyword can appear ANYWHERE — not only in \`skills\`. Check, at minimum and in this order:
   - \`personalInfo.techLine\`, \`personalInfo.summary\`, \`personalInfo.role\`, \`personalInfo.certifications\`
   - EVERY object in \`skills[]\` → its \`items\` string (comma-separated; split it and inspect each token)
   - EVERY object in \`projects[]\` → its \`stack\` AND \`description\`
   - EVERY object in \`experiences[]\` → its \`title\`, \`org\`, AND every string in its \`bullets[]\` array
   - \`education[]\`, \`customSections[]\`, and the FLATTENED KEYWORD SURFACE provided in the user message
2. A skill found in an UNEXPECTED section (e.g. "Dapr" inside a project's stack, "gRPC" in an experience bullet, "Tailwind CSS" in techLine) STILL COUNTS as present. NEVER penalize the candidate because the keyword lives in a section you did not expect. Where it appears is irrelevant — only presence/absence matters.
3. SURFACE-FORM leniency ONLY: ignore differences of CASE, SPACING, PUNCTUATION and VERSION SUFFIX when comparing the SAME written token — "Tailwind CSS" == "tailwindcss", "gRPC" == "grpc", "React 18" == "React", "PostgreSQL" == "postgresql". These are literally the same word typed differently, so they match.

## CRITICAL — NO SEMANTIC DEDUCTION (this is what makes the tool trustworthy)
You also tend to INVENT matches by reasoning about what a technology "implies". This is forbidden. Apply STRICT STRING MATCHING:
- A keyword is matched ONLY IF its exact string — or a surface-form variant per rule 3 above, or a well-known direct synonym/abbreviation of the SAME product (e.g. "Postgres" == "PostgreSQL", "k8s" == "Kubernetes") — LITERALLY appears in the CV text.
- Do NOT infer or deduce a skill from a related one. Concretely:
  * "NestJS" or "Next.js" do NOT count as "Node.js". Only match "Node.js" if the literal string "Node" / "Node.js" / "NodeJS" is written.
  * A frontend role or "CSS"/"React" do NOT count as "Responsive web design". Only match it if those exact words appear.
  * "TypeScript" does NOT count as "JavaScript"; "MySQL" does NOT count as "PostgreSQL"; "Azure" does NOT count as "AWS".
- If a required term is only "logically implied" but never written, it is MISSING. Inventing a present keyword is a MORE serious error than failing to recover one — when the literal string is absent, never mark it matched.

## Keyword extraction rules (truthful & evidence-based)
- matchedKeywords: terms required by the posting AND present anywhere in the CV. Each entry is an OBJECT:
  * \`term\`: the keyword, in the EXACT spelling from the job posting.
  * \`foundInSection\`: MANDATORY proof — the exact JSON location where you saw it (e.g. "skills.items (Backend)", "projects.stack (E-commerce API)", "experiences.bullets (Senior Dev @ Acme)", "personalInfo.techLine"). This proof forces you to actually locate the term before claiming a match. If you cannot name a concrete location, the term is NOT matched.
- missingKeywords: terms explicitly required by the posting and genuinely NOT found in the CV AFTER the exhaustive scan above. Do not invent requirements that aren't in the posting. If you are about to list a term as missing, re-scan all nested arrays one final time first.
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
    const { jobDescription, cvData, model, apiKey } = body;
    const provider = body.provider ?? providerForModel(model ?? "");

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

    // Layout + photo retirés avant l'envoi à l'IA (économie tokens, zéro intérêt analytique).
    const cvForAi = cvForAiPrompt(cvData);

    // Durées d'expérience calculées en TS et IMPOSÉES à l'IA (anti-hallucination) :
    // total + détail par poste, pour comparer l'expérience réelle aux exigences de l'offre.
    const experienceBlock = describeExperienceForPrompt(cvData.experiences);

    // Surface de mots-clés à plat : remonte skills.items, projects.stack et techLine
    // hors des tableaux imbriqués pour contrer le "Lost in the Middle".
    const keywordSurface = buildAtsKeywordSurface(cvData);

    const userPrompt = `## TARGET JOB POSTING:
${jobDescription}

## CANDIDATE'S ACTUAL EXPERIENCE (computed, DO NOT recalculate):
${experienceBlock}
- When scoring "experience" and writing recommendations, use ONLY these computed durations — never infer years yourself. Compare them against any seniority/years requirement in the posting.

## FLATTENED KEYWORD SURFACE (skills & tech stacks, un-nested for easy scanning):
${keywordSurface}
- This is an INDEX of skills already present in the CV, pulled out of nested arrays. A term listed here is PRESENT — never mark it missing. Still cross-check the full JSON below for anything not captured here (e.g. skills mentioned only in experience bullets).

## CANDIDATE'S CV (JSON):
${JSON.stringify(cvForAi, null, 2)}

## INSTRUCTIONS:
1. Extract the must-have skills, soft skills, and recurring keywords from the job posting.
2. For EACH one, perform the EXHAUSTIVE SCAN defined in the system prompt: check the flattened keyword surface AND every nested field (summary, techLine, experiences.bullets, skills.items, projects.stack & description, education, customSections). A term counts as matched no matter which section it lives in.
3. For every matched term, record its term + foundInSection (exact JSON location) as proof. Only after this scan may a term be listed in missingKeywords.
4. Score the CV honestly using the rubric in the system prompt.
5. Return ONLY the JSON report. No markdown, no prose.`;

    let result;
    try {
      result = await callWithFallback(SYSTEM_PROMPT, userPrompt, { provider, model, apiKey, temperature: ATS_TEMPERATURE });
    } catch (err) {
      console.error("All AI models failed (ATS check).");
      if (err instanceof AllProvidersFailedError) {
        return Response.json(
          {
            error: "All AI models failed.",
            details: err.failures.map((f) => `${f.model}: ${f.reason}`),
            failures: err.failures,
          },
          { status: 502 }
        );
      }
      return Response.json(
        {
          error: "All AI models failed. Check your API key and configuration.",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    const { text: rawResponse, model: usedModel } = result;

    let validation = extractAndValidate(rawResponse, atsReportSchema);

    if (!validation.success) {
      console.warn("ATS report failed validation, retrying with self-correction...", validation.issues);
      try {
        const correctionPrompt = buildCorrectionPrompt(userPrompt, validation.issues);
        const retryResult = await callWithFallback(SYSTEM_PROMPT, correctionPrompt, { provider, model: usedModel, apiKey, temperature: ATS_TEMPERATURE });
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

    // Garde-fou déterministe : on filtre les faux positifs (mots-clés "matchés"
    // mais jamais écrits dans le CV) et on récupère les faux négatifs (mots-clés
    // "manquants" pourtant littéralement présents). Le LLM est faillible ; cette
    // vérification par correspondance de chaîne, elle, ne l'est pas.
    const reconciled = reconcileAtsKeywords(
      validation.data.matchedKeywords,
      validation.data.missingKeywords,
      cvData,
    );
    if (reconciled.removedFalsePositives.length || reconciled.recoveredFalseNegatives.length) {
      console.info(
        `ATS keyword reconciliation — removed ${reconciled.removedFalsePositives.length} false positive(s) [${reconciled.removedFalsePositives.join(", ")}], recovered ${reconciled.recoveredFalseNegatives.length} false negative(s) [${reconciled.recoveredFalseNegatives.join(", ")}].`,
      );
    }

    const response: ATSCheckResponse = {
      report: {
        ...validation.data,
        matchedKeywords: reconciled.matchedKeywords,
        missingKeywords: reconciled.missingKeywords,
      },
      provider,
      model: usedModel,
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
