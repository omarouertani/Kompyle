import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import CVTemplate from "@/components/cv/CVTemplate";
import CVTemplateModern from "@/components/cv/CVTemplateModern";
import CVTemplateCanadian from "@/components/cv/CVTemplateCanadian";
import type { CVData } from "@/types/cv";
import { getTemplateEngine, type TemplateEngine } from "@/lib/cv-templates";
import { checkRateLimit } from "@/lib/rate-limiter";

/** Corps max accepté (photo en data URL comprise). La limite Vercel est 4,5 Mo. */
const MAX_BODY = 4 * 1024 * 1024;
/** L'aperçu rappelle la route toutes les ~600 ms (×2 en côte à côte) : le quota
 *  par défaut (10/min) bloquerait la saisie. */
const PDF_RATE_LIMIT = 120;
const RENDER_TIMEOUT_MS = 30_000;

/** Composant PDF de chaque moteur. Les modèles (registre `TEMPLATES`) ne
 *  diffèrent ensuite que par leur thème, porté par `data.layout.theme`. */
const PDF_ENGINES: Record<TemplateEngine, React.ComponentType<{ data: CVData; originalData?: CVData }>> = {
  classic: CVTemplate,
  modern: CVTemplateModern,
  canadian: CVTemplateCanadian,
};

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateCheck = checkRateLimit(`pdf:${ip}`, { max: PDF_RATE_LIMIT });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60_000) / 1000)) } },
    );
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!isObject(body) || !isObject(body.data) || !isObject(body.data.personalInfo) || typeof body.template !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const data = body.data as unknown as CVData;
  const template = body.template;
  const originalData = isObject(body.originalData) ? (body.originalData as unknown as CVData) : undefined;
  const sideBySide = body.sideBySide === true;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const Template = PDF_ENGINES[getTemplateEngine(template)];
    // Les templates renvoient un <Document> : on le type comme tel pour renderToBuffer.
    const doc = React.createElement(Template, {
      data,
      originalData: sideBySide && originalData ? originalData : undefined,
    }) as unknown as React.ReactElement<DocumentProps>;

    const buffer = await Promise.race([
      renderToBuffer(doc),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`renderToBuffer timed out after ${RENDER_TIMEOUT_MS}ms`)),
          RENDER_TIMEOUT_MS,
        );
      }),
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=5",
      },
    });
  } catch (err) {
    console.error("[render-pdf] error:", err);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  } finally {
    if (timer) clearTimeout(timer);
  }
}
