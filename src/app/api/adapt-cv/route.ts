import { NextRequest } from "next/server";
import type { AdaptCVRequest, AdaptCVResponse, CVData } from "@/types/cv";
import { z } from "zod";
import { resumeSchema, formatZodIssues } from "@/schemas/resumeSchema";
import { extractAndValidate } from "@/utils/ai-helpers";
import { callWithFallback, AllProvidersFailedError, providerForModel } from "@/lib/ai-orchestrator";
import { checkRateLimit } from "@/lib/rate-limiter";
import { SECTION_LABELS_EN } from "@/lib/cv-layout";
import { describeExperienceForPrompt } from "@/lib/cv-analysis";
import { cvForAiPrompt } from "@/lib/cv-payload";

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

const SYSTEM_PROMPT = `You are an elite technical recruiter, ATS (Applicant Tracking System) expert, and professional CV writer. Your job: adapt an existing CV (provided as JSON) to maximally match a specific job posting, while STRICTLY preserving its JSON structure.

## Core Strategy & Conflict Resolution
1. Valid JSON matching the exact schema (never break the shape).
2. Truthfulness (never invent, exaggerate, or hallucinate skills/metrics).
3. ATS Optimization (Match exact keywords from the job description).
4. Dense single A4 page (aim 500-650 words: use the page to surface relevant, truthful keywords — do not pad with fluff, but do not leave it sparse either).

## Modifiable Fields & Rules
- personalInfo.role: Adapt the title to closely match the target job title if truthful.
- personalInfo.summary: Max 3-4 lines. Hook the reader immediately. Front-load the exact skills and years of experience (provided by the user prompt) that match the job.
- personalInfo.techLine: Reorder keywords, placing the ones mentioned in the job posting first.
- experiences[].bullets[]:
    * MUST use the XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]".
    * Max 15-20 words per bullet.
    * Rephrase to weave in the job's exact terminology.
    * REFRAME by the job's axis: a full-stack engineer has done backend, frontend, DevOps and testing. If the job is backend-focused, lead each bullet with the backend angle (APIs, data, performance) and keep frontend/other mentions short but present; if it is frontend-focused, do the inverse. Same real work, different emphasis.
- skills[].items: Reorder to prioritize job demands. You may adjust terminology to exactly match the ATS keywords (e.g., "Node" -> "Node.js" if the job asks for Node.js).
- projects[].description: Rephrase to emphasize the part of the stack and the impact relevant to the target role's axis (e.g. surface the backend contribution for a backend role), without dropping the project's other facets.

## ATS Keyword Surfacing — aggressive but TRUTHFUL
The CV often already contains a skill implicitly; your job is to make it EXPLICIT with the job's exact wording so the ATS detects it.
- Mirror the job's exact terminology everywhere (summary, techLine, bullets, skills[].items). If the job says "REST API" and the CV says "web services", align to "REST API" when it's the same real work.
- Make GENUINELY-IMPLIED ecosystem keywords explicit by appending them inside the relevant skills[].items string (this changes text, NOT array length):
    * A Java/Spring Boot stack implies the build tool: "Maven" (or "Gradle" if mentioned).
    * Server-rendered or SPA UI work (JSP, Angular, React) implies "HTML5" and "CSS3".
    * JUnit / Mockito imply "Unit Testing" / "Testing".
    * Production incident / root-cause work implies "Troubleshooting" and "Debugging".
    * CI/CD + Git workflows imply "Version Control".
  Only add a keyword when an EXISTING CV entry genuinely entails it. If nothing in the CV supports it, DO NOT add it — leave the ATS gap rather than fabricate.
- NEVER DROP a real technology already in the CV to make room for new keywords. Keep every existing, still-relevant tech (e.g. keep "JQuery", "Hibernate", "Angular") AND add the implied ones. Surfacing is additive.
- Soft skills (ATS scores these as discrete keywords): when the CV genuinely backs them, state them EXPLICITLY in the summary using the job's own wording. In particular, almost always applicable for an engineer with this history:
    * "Problem-solving" ← root-cause / incident-resolution work.
    * "Collaboration" / "collaborative" ← agile, cross-functional, or multi-team work.
    * "Ability to work with AI tools" ← any GenAI/LLM integration (e.g. Gemini API) or AI automation (n8n/Make) in the projects.
  Do not claim a soft skill with zero basis.
- Generic umbrella keywords: weave in the broad terms an ATS expects when they truthfully describe the work — "Software development", "Documentation", "Technical solutions", "Productivity improvements" (e.g. dashboards that cut resolution time = a productivity improvement). These are almost always truthful for a developer; include them naturally in summary/bullets.
- Job-domain phrases: mirror a domain term from the posting ONLY when the candidate's real work maps to it (e.g. a broker/insurance portal serving brokers ≈ "front-office users"). NEVER claim a domain artifact the candidate never built (e.g. do not invent a "booking application" if there is none).

## Reframing, NOT Deletion
- NEVER remove any item from any array (experiences, projects, skills, bullets). Removing roles or projects creates employment gaps / blank years on the CV, which is disqualifying.
- NEVER add a new item to any array either.
- Keep the EXACT same number of experiences, projects, skills groups, and bullets as the input. Adapt their wording and ordering of emphasis only.
- Even a less-relevant experience or project stays: rewrite it to surface whatever angle is closest to the job, even if minor.

## Immutable Fields (Copy VERBATIM)
- personalInfo.name, email, phone, location, linkedin, portfolio
- experiences[].title, org, date
- skills[].category
- projects[].title, stack
- spokenLanguages[]
- education[]
- customSections[]
- Any id / forcePageBreak / customMarginBottom metadata.

## Hard Constraints (Immediate Failure if violated)
1. Preserve EXACT keys. Never add/rename keys.
2. Never change the number of items in any array (same count of experiences, projects, skills, and bullets). Never delete or add an item.
3. NO HALLUCINATIONS: Never invent metrics, skills, or past experiences.
4. NO MATH HALLUCINATIONS: Do not calculate years of experience. Use ONLY the number provided in the user prompt.
5. Output ONLY valid JSON matching this schema:

${RESUME_SCHEMA_JSON}`;

// Prompt de correction (self-healing retry) : on renvoie au modèle ses propres
// erreurs de validation Zod pour qu'il produise un JSON conforme au 2e essai.
function buildCorrectionPrompt(originalUserPrompt: string, issues: string[]): string {
  return `${originalUserPrompt}

## Your previous answer was REJECTED
It failed strict schema validation with these errors:
${issues.map((issue) => `- ${issue}`).join("\n")}

Return ONLY a corrected raw JSON object that fixes these errors and fully respects the schema and all rules above. No markdown, no commentary.`;
}

// Détecte si une offre est rédigée en anglais ou en français, par fréquence de
// mots-outils distinctifs. Sert à aligner les TITRES de section sur la langue de
// l'offre : un ATS anglophone qui lit "Éducation" ne reconnaît pas la section
// "Education" et la déclare manquante. Heuristique volontairement simple et
// déterministe (pas d'appel réseau) ; défaut "fr" si indécis (public FR de l'app).
function detectJobLanguage(text: string): "en" | "fr" {
  const FR = ["le", "la", "les", "des", "une", "un", "vous", "nous", "pour", "avec", "dans", "votre", "notre", "compétences", "expérience", "poste", "entreprise", "équipe", "missions", "profil", "et", "ou", "au", "aux", "du"];
  const EN = ["the", "and", "or", "for", "with", "you", "we", "your", "our", "skills", "experience", "role", "team", "company", "requirements", "responsibilities", "must", "ability", "will", "of", "to", "in"];
  const words = text.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]+/g) ?? [];
  const set = (list: string[]) => new Set(list);
  const frSet = set(FR);
  const enSet = set(EN);
  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (frSet.has(w)) fr++;
    if (enSet.has(w)) en++;
  }
  return en > fr ? "en" : "fr";
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

    // Layout (piloté par l'utilisateur) ET photo (image volumineuse) retirés avant
    // l'envoi à l'IA : économie de tokens, et la photo est ré-imposée à la sortie.
    const cvForAi = cvForAiPrompt(cvData);

    // Durées d'expérience calculées en TS et imposées à l'IA (anti-hallucination).
    const experienceBlock = describeExperienceForPrompt(cvData.experiences);

    // Build the user prompt
    const userPrompt = `## TARGET JOB POSTING:
${jobDescription}

## CANDIDATE'S ACTUAL EXPERIENCE LIMITS (DO NOT INVENT):
${experienceBlock}
- If the job requires more years, DO NOT lie. Highlight intensity, fast learning, and high-impact projects instead.

## CURRENT CV (JSON):
${JSON.stringify(cvForAi, null, 2)}

## INSTRUCTIONS:
1. Mentally extract the top 5 mandatory technical skills and top 3 soft skills from the job posting, and identify the role's axis (e.g. backend, frontend, DevOps, data, testing).
2. Adapt the CV to highlight these exact skills based ONLY on the candidate's actual history.
3. Keep EVERY experience and project (no deletions — removing any creates blank years). Instead, reframe each one toward the job's axis: lead with the relevant angle, keep the other facets short but present.
4. Keep the same number of bullets per experience; tighten wording for A4 readability without cutting items.
5. Return ONLY the modified JSON object. No markdown, no prose.`;

    // Call the selected provider/model (OpenRouter falls back across free models)
    let result;
    try {
      result = await callWithFallback(SYSTEM_PROMPT, userPrompt, { provider, model, apiKey });
    } catch (err) {
      console.error("All AI models failed (adapt-cv).");
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

    // Extract + repair + validate the AI output with self-healing retry
    let validation = extractAndValidate(rawResponse, resumeSchema);

    if (!validation.success) {
      console.warn("Adapted CV failed validation, retrying with self-correction...", validation.issues);
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

    // ATS heading alignment: an English ATS doesn't recognize "Éducation" as the
    // "Education" section and flags it missing. When the job posting is in
    // English, relabel the BUILT-IN sections with the exact ATS-standard English
    // headings (Experience / Education / Skills / …). Only the adapted copy is
    // touched — the user's saved CV keeps its own titles. Custom sections
    // (custom_*) are user-authored and left untouched.
    if (adaptedCV.layout && detectJobLanguage(jobDescription) === "en") {
      adaptedCV.layout = {
        ...adaptedCV.layout,
        sectionTitles: { ...adaptedCV.layout.sectionTitles, ...SECTION_LABELS_EN },
      };
    }

    // Preserve immutable experience fields. The AI keeps the same items in the
    // same order (no deletion / no add), so index-based re-imposition is safe;
    // the `?? exp.x` fallback guards any rare count mismatch without overruns.
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
      provider,
      model: usedModel,
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
