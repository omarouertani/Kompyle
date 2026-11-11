import { NextRequest, NextResponse } from "next/server";
import { cvToDocxBuffer } from "@/lib/cv-docx";
import { readRenderRequest } from "@/lib/render-request";

/** Export DOCX (une colonne, ordre de lecture) : mêmes limites que /api/render-pdf. */
export async function POST(req: NextRequest) {
  const parsed = await readRenderRequest(req, "docx");
  if (parsed instanceof NextResponse) return parsed;

  try {
    const buffer = await cvToDocxBuffer(parsed.data);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[render-docx] error:", err);
    return NextResponse.json({ error: "DOCX generation failed" }, { status: 500 });
  }
}
