/**
 * Lecture d'un CV déposé par l'utilisateur, DANS LE NAVIGATEUR : le fichier ne
 * quitte jamais l'appareil ; seul le texte extrait est ensuite envoyé au
 * provider IA choisi (étape séparée, annoncée dans l'interface).
 *
 *  - TXT / MD : lecture directe ;
 *  - DOCX : sans dépendance (`docx-text.ts`) ;
 *  - PDF : `unpdf` (pdf.js), chargé à la demande uniquement pour un PDF.
 */

import { extractDocxText } from "./docx-text";
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_TEXT_CHARS,
  MIN_IMPORT_TEXT_CHARS,
  cleanExtractedText,
  meaningfulLength,
} from "./limits";

export type ImportFileKind = "pdf" | "docx" | "txt" | "paste";

/** Erreur d'extraction, avec un code traduit par l'interface (namespace CVImport). */
export type ExtractErrorCode =
  | "unsupported"   // format non pris en charge (.doc, .odt, image…)
  | "too_large"     // fichier > 10 Mo
  | "scanned"       // PDF sans couche texte (scan / image)
  | "empty"         // texte trop court pour être un CV
  | "read_failed";  // fichier illisible ou corrompu

export class ExtractError extends Error {
  constructor(public code: ExtractErrorCode) {
    super(code);
    this.name = "ExtractError";
  }
}

export interface ExtractedText {
  text: string;
  kind: ImportFileKind;
  /** Vrai si le texte a été coupé à MAX_IMPORT_TEXT_CHARS. */
  truncated: boolean;
}

/** Type de fichier d'après l'extension, puis le type MIME. */
export function detectKind(file: { name: string; type: string }): ImportFileKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (name.endsWith(".txt") || name.endsWith(".md") || file.type === "text/plain" || file.type === "text/markdown") return "txt";
  return null;
}

async function readPdfText(buffer: ArrayBuffer): Promise<string> {
  const { extractText } = await import("unpdf");
  // extractText ouvre puis libère lui-même le document pdf.js.
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text;
}

/** Finalise un texte brut : nettoyage, contrôle de longueur, troncature. */
export function finalizeText(raw: string, kind: ImportFileKind): ExtractedText {
  const text = cleanExtractedText(raw);
  if (meaningfulLength(text) < MIN_IMPORT_TEXT_CHARS) {
    throw new ExtractError(kind === "pdf" ? "scanned" : "empty");
  }
  const truncated = text.length > MAX_IMPORT_TEXT_CHARS;
  return { text: truncated ? text.slice(0, MAX_IMPORT_TEXT_CHARS) : text, kind, truncated };
}

/** Extrait le texte d'un fichier déposé ou choisi. */
export async function extractCvText(file: File): Promise<ExtractedText> {
  const kind = detectKind(file);
  if (!kind) throw new ExtractError("unsupported");
  if (file.size > MAX_IMPORT_FILE_BYTES) throw new ExtractError("too_large");

  let raw: string;
  try {
    if (kind === "txt") raw = await file.text();
    else if (kind === "docx") raw = await extractDocxText(await file.arrayBuffer());
    else raw = await readPdfText(await file.arrayBuffer());
  } catch {
    throw new ExtractError("read_failed");
  }
  return finalizeText(raw, kind);
}
