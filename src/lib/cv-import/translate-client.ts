import type { AIProvider, CVLang } from "@/types/cv";
import type { ImportedCV } from "./schema";

interface TranslateDeps {
  provider: AIProvider;
  model: string;
  apiKey: string | undefined;
}

/** Demande la version `target` d'un CV importé (/api/translate-cv). Renvoie null
 *  en cas d'échec : l'import reste utilisable dans sa langue d'origine. */
export async function requestCVTranslation(
  cv: ImportedCV,
  target: CVLang,
  { provider, model, apiKey }: TranslateDeps
): Promise<ImportedCV | null> {
  if (!apiKey?.trim()) return null;
  try {
    const res = await fetch("/api/translate-cv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cv, target, provider, model, apiKey }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { cv?: ImportedCV };
    return data.cv ? { ...data.cv, language: target } : null;
  } catch {
    return null;
  }
}

/** Toast à afficher après un changement de langue de l'app (la page est
 *  remontée : le toast est transmis via sessionStorage). */
export const PENDING_TOAST_KEY = "kompyle_pending_toast";

export function setPendingToast(message: string, description?: string): void {
  try {
    sessionStorage.setItem(PENDING_TOAST_KEY, JSON.stringify({ message, description }));
  } catch {
    // stockage indisponible : pas de toast après la bascule, sans autre effet
  }
}

export function takePendingToast(): { message: string; description?: string } | null {
  try {
    const raw = sessionStorage.getItem(PENDING_TOAST_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_TOAST_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
