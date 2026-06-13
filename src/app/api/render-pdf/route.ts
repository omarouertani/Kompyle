import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, Document, Page, Text, View } from "@react-pdf/renderer";
import CVTemplate from "@/components/cv/CVTemplate";
import CVTemplateModern from "@/components/cv/CVTemplateModern";
import CVTemplateCanadian from "@/components/cv/CVTemplateCanadian";
import type { CVData } from "@/types/cv";
import { isModernTemplate } from "@/lib/cv-layout";

export async function POST(req: NextRequest) {
  try {
    console.log("[render-pdf] 1. Parsing request body...");
    const body = await req.json();
    const { data, template, originalData, sideBySide, test } = body as {
      data: CVData;
      template: string;
      originalData?: CVData | null;
      sideBySide?: boolean;
      test?: boolean;
    };

    console.log("[render-pdf] 2. Body parsed, template:", template);

    let doc;
    if (test) {
      // Minimal document to test if renderToBuffer works at all
      console.log("[render-pdf] 3. Creating MINIMAL test element...");
      doc = React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          { size: "A4" },
          React.createElement(View, null,
            React.createElement(Text, null, "Test PDF")
          )
        )
      );
    } else {
      console.log("[render-pdf] 3. Creating template element...");
      const Template = isModernTemplate(template)
        ? CVTemplateModern
        : template === "canadian"
          ? CVTemplateCanadian
          : CVTemplate;
      doc = React.createElement(Template, {
        data,
        originalData: sideBySide && originalData ? originalData : undefined,
      });
    }

    console.log("[render-pdf] 4. Starting renderToBuffer...");
    const start = Date.now();
    const timeoutMs = 30000;
    const buffer = await Promise.race([
      renderToBuffer(doc as any),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`renderToBuffer timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    console.log("[render-pdf] 5. Done in", Date.now() - start, "ms, size:", buffer.byteLength);
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=5",
      },
    });
  } catch (err) {
    console.error("[render-pdf] error:", err);
    return NextResponse.json(
      { error: "PDF generation failed", detail: String(err) },
      { status: 500 }
    );
  }
}
