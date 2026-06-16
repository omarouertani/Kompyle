import { NextRequest } from "next/server";
import type { RefineCVRequest, RefineCVResponse, CVData } from "@/types/cv";
import { z } from "zod";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback, AllProvidersFailedError, providerForModel } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";
import { cvForAiPrompt } from "@/lib/cv-payload";

// ─── System Prompt ──────────────────────────────────────────────────────────

let RESUME_SCHEMA_JSON = "";
try {
  RESUME_SCHEMA_JSON = JSON.stringify(z.toJSONSchema(resumeSchema), null, 2);
} catch {
  RESUME_SCHEMA_JSON = "";
}

const SYSTEM_PROMPT = `You are an elite professional CV editor. The user already has a CV (provided as JSON) and gives you ONE editing instruction. Your job: apply EXACTLY that instruction — nothing more, nothing less.

## Conflict resolution order (when rules collide)
1. Valid JSON matching the exact schema (never break the shape).
2. Truthfulness (never invent facts, skills, metrics, or experiences not present in the CV or explicitly provided in the instruction).
3. The user's instruction.
4. One-page A4 conciseness.

## Surgical editing — the golden rule
- Modify ONLY what the instruction targets. Every other field MUST be copied character-for-character from the input CV.
- If the instruction is ambiguous, choose the most conservative interpretation (smallest change).
- If the instruction asks for something impossible or that would require inventing facts, apply the closest truthful change instead (e.g. rephrase with existing facts rather than fabricating).
- The user MAY legitimately ask to change any text: title, role, bullets, skills, dates, names of sections… Apply it. New factual content stated in the instruction itself counts as user-provided truth.
- Adding or removing array items is allowed ONLY if the instruction explicitly asks for it (e.g. "remove the second bullet", "add a skill X").

## Hard constraints
1. Preserve the EXACT key structure of the schema — never add, remove, or rename a key.
2. Copy all id / forcePageBreak / customMarginBottom metadata verbatim for untouched items.
3. Keep the language of the CV unless the instruction asks to change it.
4. Single A4 page: do not significantly increase total text length unless explicitly asked.

## Output contract
- Return ONLY one raw JSON object — no markdown fences, no comments, no prose before or after.
- It MUST validate against this exact JSON schema:

${RESUME_SCHEMA_JSON}

## Final self-check before answering
- Did I change ONLY what the instruction asked?
- Is everything else copied verbatim from the input?
- Is the output a single valid JSON object, directly parsable, with nothing outside it?`;

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

    const body = (await request.json()) as RefineCVRequest;
    const { instruction, cvData, jobDescription, model, apiKey } = body;
    const provider = body.provider ?? providerForModel(model ?? "");

    if (!instruction || typeof instruction !== "string" || instruction.trim().length < 3) {
      return Response.json(
        { error: "The instruction must contain at least 3 characters." },
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

    // Layout (user-controlled) ET photo (image volumineuse) jamais envoyés à l'IA,
    // ré-imposés à la sortie.
    const cvForAi = cvForAiPrompt(cvData);

    const jobContext = jobDescription?.trim()
      ? `## Original target job posting (context only — keep the CV aligned with it):

${jobDescription.trim()}

`
      : "";

    const userPrompt = `${jobContext}## Current CV (JSON):

${JSON.stringify(cvForAi, null, 2)}

## User instruction to apply:

${instruction.trim()}

Apply this instruction surgically and return only the modified JSON.`;

    let result;
    try {
      result = await callWithFallback(SYSTEM_PROMPT, userPrompt, { provider, model, apiKey });
    } catch (err) {
      console.error("All AI models failed (refine-cv).");
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

    // Extract + repair + validate avec self-healing retry (même pipeline que /api/adapt-cv)
    let validation = extractAndValidate(rawResponse, resumeSchema);

    if (!validation.success) {
      console.warn("Refined CV failed validation, retrying with self-correction...", validation.issues);
      try {
        const correctionPrompt = buildCorrectionPrompt(userPrompt, validation.issues);
        const retryResult = await callWithFallback(SYSTEM_PROMPT, correctionPrompt, { provider, model: usedModel, apiKey });
        validation = extractAndValidate(retryResult.text, resumeSchema);
      } catch (retryError) {
        console.error("Self-correction retry failed:", retryError);
      }
    }

    if (!validation.success) {
      return Response.json(
        {
          error: "The refined CV structure is invalid.",
          details: validation.issues,
        },
        { status: 502 }
      );
    }

    const refinedCV: CVData = validation.data;

    // Champs jamais pilotés par l'IA, ré-imposés depuis le CV d'entrée.
    refinedCV.layout = cvData.layout;
    refinedCV.personalInfo.photo = cvData.personalInfo.photo;

    // Stabilité des ids (clés React / positions canvas) : quand les longueurs
    // correspondent, on garde les ids d'origine ; sinon (ajout/suppression
    // demandé par l'utilisateur) les nouveaux items recevront un id côté client.
    const preserveIds = <T extends { id?: string }>(next: T[], prev: T[]): T[] =>
      next.length === prev.length ? next.map((item, i) => ({ ...item, id: prev[i]?.id ?? item.id })) : next;

    refinedCV.experiences = preserveIds(refinedCV.experiences, cvData.experiences);
    refinedCV.skills = preserveIds(refinedCV.skills, cvData.skills);
    refinedCV.projects = preserveIds(refinedCV.projects, cvData.projects);
    refinedCV.education = preserveIds(refinedCV.education, cvData.education);
    // Sections libres : on garde le contenu raffiné par l'IA mais on RÉ-IMPOSE
    // les ids d'origine (le layout référence `custom_<id>` — un id qui change
    // ferait disparaître la section). Si l'IA les a omises, on restaure l'original.
    refinedCV.customSections =
      refinedCV.customSections && cvData.customSections
        ? preserveIds(refinedCV.customSections, cvData.customSections)
        : cvData.customSections;

    const response: RefineCVResponse = {
      refinedCV,
      provider,
      model: usedModel,
    };

    return Response.json(response);
  } catch (error) {
    console.error("Unexpected error in /api/refine-cv:", error);
    return Response.json(
      {
        error: "An unexpected error occurred.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
