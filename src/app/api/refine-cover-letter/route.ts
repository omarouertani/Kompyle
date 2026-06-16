import { NextRequest, NextResponse } from "next/server";
import type { RefineCoverLetterRequest, RefineCoverLetterResponse } from "@/types/cv";
import { z } from "zod";
import { coverLetterSchema } from "@/schemas/coverLetterSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback, AllProvidersFailedError, providerForModel } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";

let COVER_LETTER_SCHEMA_JSON = "";
try {
  COVER_LETTER_SCHEMA_JSON = JSON.stringify(z.toJSONSchema(coverLetterSchema), null, 2);
} catch {
  COVER_LETTER_SCHEMA_JSON = "";
}

const SYSTEM_PROMPT = `You are an elite professional cover-letter editor. The user already has a cover letter (provided as JSON) and gives you ONE editing instruction. Your job: apply EXACTLY that instruction — nothing more, nothing less.

## Rules (CRITICAL)
1. Modify ONLY what the instruction targets. Every other field MUST be copied character-for-character from the input letter.
2. Never invent facts, company names, contact names, or achievements. New factual content stated in the instruction itself counts as user-provided truth.
3. Keep the language of the letter unless the instruction asks to change it.
4. Keep the tone professional, persuasive and direct.
5. If the instruction is ambiguous, choose the most conservative interpretation (smallest change).

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

    const body = (await req.json()) as RefineCoverLetterRequest;
    const { instruction, coverLetter, jobDescription, model, apiKey } = body;
    const provider = body.provider ?? providerForModel(model ?? "");

    if (!instruction || typeof instruction !== "string" || instruction.trim().length < 3) {
      return NextResponse.json(
        { error: "The instruction must contain at least 3 characters." },
        { status: 400 }
      );
    }

    const inputValidation = coverLetterSchema.safeParse(coverLetter);
    if (!inputValidation.success) {
      return NextResponse.json(
        { error: "The cover letter data is invalid or incomplete." },
        { status: 400 }
      );
    }

    const jobContext = jobDescription?.trim()
      ? `## Original target job posting (context only — keep the letter aligned with it):

${jobDescription.trim()}

`
      : "";

    const userPrompt = `${jobContext}## Current cover letter (JSON):

${JSON.stringify(coverLetter, null, 2)}

## User instruction to apply:

${instruction.trim()}

Apply this instruction surgically and return only the modified JSON.`;

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

    let validation = extractAndValidate(rawResponse, coverLetterSchema);

    if (!validation.success) {
      console.warn("Refined cover letter failed validation, retrying with self-correction...", validation.issues);
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
        { error: "The refined cover letter structure is invalid.", details: validation.issues },
        { status: 502 }
      );
    }

    const response: RefineCoverLetterResponse = {
      coverLetter: validation.data,
      provider,
      model: usedModel,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in /api/refine-cover-letter:", error);
    return NextResponse.json(
      {
        error: "An unexpected error occurred.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
