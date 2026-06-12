import { NextRequest } from "next/server";
import type { AdaptCVRequest, AdaptCVResponse, CVData } from "@/types/cv";
import { z } from "zod";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";

// ─── System Prompt ──────────────────────────────────────────────────────────

// Schéma JSON canonique injecté dans le prompt : le modèle voit la forme EXACTE
// attendue, descriptions comprises (issues des .describe() du schéma Zod).
// Calculé une seule fois au chargement du module.
let RESUME_SCHEMA_JSON = "";
try {
  RESUME_SCHEMA_JSON = JSON.stringify(z.toJSONSchema(resumeSchema), null, 2);
} catch {
  RESUME_SCHEMA_JSON = "";
}

const SYSTEM_PROMPT = `You are an elite technical recruiter and professional CV writer. Your job: adapt an existing CV (provided as JSON) to maximally match a specific job posting, while STRICTLY preserving its structure.

## Conflict resolution order (when rules collide)
1. Valid JSON matching the exact schema (never break the shape).
2. Truthfulness (never invent, exaggerate, or add skills the candidate lacks).
3. Relevance to the target job.
4. One-page A4 conciseness.

## Modifiable fields — adapt the TEXT only
- personalInfo.role — adapt the CV title to closely match the target job role.
- personalInfo.summary — rewrite to front-load the skills/experience most relevant to the role.
- personalInfo.techLine — reorder / lightly rephrase keywords, most relevant first.
- experiences[].bullets[] — rephrase to weave in the job's terminology and surface relevant, quantified achievements. Keep the SAME number of bullets.
- skills[].items — reorder to prioritize what the job demands; light rephrase allowed only if truthful (e.g. "React" → "React / React Native").
- projects[].description — rephrase to emphasize role-relevant aspects.

## Immutable fields — copy VERBATIM, never change
- personalInfo.name, email, phone, location, linkedin, portfolio
- experiences[].title, org, date
- skills[].category
- projects[].title, stack
- spokenLanguages[]
- education[] (every field)
- customSections[] (every field — user-authored, copy verbatim)
- Any id / forcePageBreak / customMarginBottom metadata, if present.

## Hard constraints
1. Preserve the EXACT key structure — never add, remove, or rename a key.
2. Never change the number of items in any array (same count of experiences, bullets, skills, projects…).
3. Never invent experiences, skills, technologies, or metrics absent from the original.
4. Never delete a bullet — rephrase it, don't remove it.
5. CRITICAL — single A4 page: do NOT increase total text length. Keep summary and bullets tight; if you add words somewhere, cut words elsewhere.

## Quality bar
- Lead bullets with impact (strong action verb + result), then context.
- Mirror the job posting's vocabulary for ATS alignment — only where truthful.
- Keep quantified outcomes already present; never fabricate numbers.
- Match the job posting's language (FR posting → FR content; EN → EN).

## Output contract
- Return ONLY one raw JSON object — no markdown fences, no comments, no prose before or after.
- It MUST validate against this exact JSON schema:

${RESUME_SCHEMA_JSON}

## Final self-check before answering
- Same keys and same array lengths as the input CV?
- Every immutable field copied verbatim?
- Output is a single valid JSON object, directly parsable, with nothing outside it?`;

// Prompt de correction (self-healing retry) : on renvoie au modèle ses propres
// erreurs de validation Zod pour qu'il produise un JSON conforme au 2e essai.
function buildCorrectionPrompt(originalUserPrompt: string, issues: string[]): string {
  return `${originalUserPrompt}

## Your previous answer was REJECTED
It failed strict schema validation with these errors:
${issues.map((issue) => `- ${issue}`).join("\n")}

Return ONLY a corrected raw JSON object that fixes these errors and fully respects the schema and all rules above. No markdown, no commentary.`;
}

// ─── Route Handler ──────────────────────────────────────────────────────────

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

    const body = (await request.json()) as AdaptCVRequest;
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

    // Strip the layout before sending to the AI: it's user-controlled, not the
    // model's concern, and omitting it saves tokens + avoids any tampering.
    const { layout: _layout, ...cvForAi } = cvData;

    // Build the user prompt
    const userPrompt = `## Target job posting:

${jobDescription}

## Current CV to adapt (JSON):

${JSON.stringify(cvForAi, null, 2)}

Adapt this CV to maximize the candidate's chances for this role. Return only the modified JSON.`;

    // Call the selected AI provider with fallback
    let result;
    try {
      result = await callWithFallback(SYSTEM_PROMPT, userPrompt, provider, model);
    } catch (err) {
      console.error("All AI providers failed.");
      return Response.json(
        {
          error: "All AI providers failed. Check your API keys and configuration.",
          details: err instanceof Error ? err.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    const { text: rawResponse, provider: usedProvider } = result;

    // Extract + repair + validate the AI output with self-healing retry
    let validation = extractAndValidate(rawResponse, resumeSchema);

    if (!validation.success) {
      console.warn("Adapted CV failed validation, retrying with self-correction...", validation.issues);
      try {
        const correctionPrompt = buildCorrectionPrompt(userPrompt, validation.issues);
        const retryResult = await callWithFallback(SYSTEM_PROMPT, correctionPrompt, usedProvider, model);
        validation = extractAndValidate(retryResult.text, resumeSchema);
      } catch (retryError) {
        console.error("Self-correction retry failed:", retryError);
      }
    }

    if (!validation.success) {
      return Response.json(
        {
          error: "The adapted CV structure is invalid.",
          details: validation.issues,
        },
        { status: 502 }
      );
    }

    // Schema-validated data (unknown keys stripped). `const` is fine: the
    // immutable-field re-imposition below mutates properties, not the binding.
    const adaptedCV: CVData = validation.data;

    // Preserve immutable fields from the original CV
    adaptedCV.personalInfo.name = cvData.personalInfo.name;
    // Note: personalInfo.role is now adapted by the AI
    adaptedCV.personalInfo.email = cvData.personalInfo.email;
    adaptedCV.personalInfo.phone = cvData.personalInfo.phone;
    adaptedCV.personalInfo.location = cvData.personalInfo.location;
    adaptedCV.personalInfo.linkedin = cvData.personalInfo.linkedin;
    adaptedCV.personalInfo.portfolio = cvData.personalInfo.portfolio;
    adaptedCV.personalInfo.photo = cvData.personalInfo.photo;
    adaptedCV.personalInfo.birthDate = cvData.personalInfo.birthDate;
    adaptedCV.personalInfo.certifications = cvData.personalInfo.certifications;
    adaptedCV.personalInfo.interests = cvData.personalInfo.interests;
    adaptedCV.education = cvData.education;
    adaptedCV.spokenLanguages = cvData.spokenLanguages;
    adaptedCV.customSections = cvData.customSections; // user-authored, never from the AI

    // Layout piloté par l'utilisateur, jamais par l'IA. MAIS on retire les
    // positions absolues du canvas : elles ont été calculées pour l'ANCIEN
    // contenu ; les réappliquer au texte adapté (longueurs différentes) fait
    // chevaucher les sections. Le canvas recalcule un empilement propre à
    // partir des hauteurs réelles du nouveau contenu. Pages / sidebar / thème
    // (structure choisie par l'utilisateur) sont conservés.
    if (cvData.layout) {
      const { absolutePositions: _ap, useAbsolutePositioning: _uap, ...layoutStructure } = cvData.layout;
      adaptedCV.layout = layoutStructure;
    } else {
      adaptedCV.layout = cvData.layout;
    }

    // Preserve immutable experience fields
    adaptedCV.experiences = adaptedCV.experiences.map((exp, i) => ({
      ...exp,
      title: cvData.experiences[i]?.title ?? exp.title,
      org: cvData.experiences[i]?.org ?? exp.org,
      date: cvData.experiences[i]?.date ?? exp.date,
      id: cvData.experiences[i]?.id ?? exp.id,
      forcePageBreak: cvData.experiences[i]?.forcePageBreak ?? exp.forcePageBreak,
      customMarginBottom: cvData.experiences[i]?.customMarginBottom ?? exp.customMarginBottom,
    }));

    // Preserve immutable skill categories (and stable id for the editor/React keys)
    adaptedCV.skills = adaptedCV.skills.map((group, i) => ({
      ...group,
      id: cvData.skills[i]?.id ?? group.id,
      category: cvData.skills[i]?.category ?? group.category,
    }));

    // Preserve immutable project fields
    adaptedCV.projects = adaptedCV.projects.map((proj, i) => ({
      ...proj,
      title: cvData.projects[i]?.title ?? proj.title,
      stack: cvData.projects[i]?.stack ?? proj.stack,
      id: cvData.projects[i]?.id ?? proj.id,
      forcePageBreak: cvData.projects[i]?.forcePageBreak ?? proj.forcePageBreak,
      customMarginBottom: cvData.projects[i]?.customMarginBottom ?? proj.customMarginBottom,
    }));

    // Preserve immutable education fields (already assigned fully, but let's ensure we map array if we want ID preservation)
    // Actually education is already: adaptedCV.education = cvData.education;
    // So education automatically preserves everything because it just takes the original array!

    const response: AdaptCVResponse = {
      adaptedCV,
      provider: usedProvider,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Unexpected error in /api/adapt-cv:", error);
    return Response.json(
      {
        error: "An unexpected error occurred.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
