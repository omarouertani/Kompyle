import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import CVTemplate from "@/components/cv/CVTemplate";
import CVTemplateModern from "@/components/cv/CVTemplateModern";
import CVTemplateCanadian from "@/components/cv/CVTemplateCanadian";
import type { CVData } from "@/types/cv";
import { getTemplateEngine, type TemplateEngine } from "@/lib/cv-templates";
import { readRenderRequest } from "@/lib/render-request";

const RENDER_TIMEOUT_MS = 30_000;

/** Composant PDF de chaque moteur. Les modèles (registre `TEMPLATES`) ne
 *  diffèrent ensuite que par leur thème, porté par `data.layout.theme`. */
const PDF_ENGINES: Record<TemplateEngine, React.ComponentType<{ data: CVData; originalData?: CVData }>> = {
  classic: CVTemplate,
  modern: CVTemplateModern,
  canadian: CVTemplateCanadian,
};

export async function POST(req: NextRequest) {
  const parsed = await readRenderRequest(req, "pdf");
  if (parsed instanceof NextResponse) return parsed;
  const { data, template, originalData, sideBySide } = parsed;

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
