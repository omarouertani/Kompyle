import { NextRequest, NextResponse } from "next/server";
import type { CVData } from "@/types/cv";
import { checkRateLimit } from "@/lib/rate-limiter";

/** Corps max accepté (photo en data URL comprise). La limite Vercel est 4,5 Mo. */
export const MAX_RENDER_BODY = 4 * 1024 * 1024;
/** L'aperçu rappelle la route PDF toutes les ~600 ms (×2 en côte à côte) : le
 *  quota par défaut (10/min) bloquerait la saisie. Même quota pour le DOCX. */
export const RENDER_RATE_LIMIT = 120;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export interface RenderRequest {
  data: CVData;
  template: string;
  originalData?: CVData;
  sideBySide: boolean;
}

/**
 * Contrôles communs des routes de rendu (PDF, DOCX) : limite de requêtes par
 * IP (`scope` sépare les compteurs), taille du corps, JSON valide et forme
 * minimale. Renvoie la requête lue, ou la réponse d'erreur à retourner.
 */
export async function readRenderRequest(req: NextRequest, scope: string): Promise<RenderRequest | NextResponse> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rateCheck = checkRateLimit(`${scope}:${ip}`, { max: RENDER_RATE_LIMIT });
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateCheck.retryAfterMs ?? 60_000) / 1000)) } },
    );
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_RENDER_BODY) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }
  const raw = await req.text();
  if (raw.length > MAX_RENDER_BODY) {
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
  return {
    data: body.data as unknown as CVData,
    template: body.template,
    originalData: isObject(body.originalData) ? (body.originalData as unknown as CVData) : undefined,
    sideBySide: body.sideBySide === true,
  };
}
