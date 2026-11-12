/** Limites de l'import de CV, partagées par le client et la route `/api/import-cv`. */

/** Taille maximale du fichier déposé (lu dans le navigateur, jamais envoyé). */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

/** Texte envoyé à l'IA : un CV fait 3 000 à 8 000 caractères ; au-delà on tronque. */
export const MAX_IMPORT_TEXT_CHARS = 30_000;

/** En dessous, ce n'est pas un CV exploitable (ou un PDF scanné sans texte). */
export const MIN_IMPORT_TEXT_CHARS = 80;

/** Corps JSON maximal accepté par la route (texte + clé + modèle). */
export const MAX_IMPORT_BODY_BYTES = 200 * 1024;

/** Extensions acceptées par le sélecteur de fichier. */
export const IMPORT_ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

/**
 * Nettoie un texte extrait : fins de ligne unifiées, espaces insécables et
 * caractères de contrôle retirés, espaces en fin de ligne supprimés, pas plus
 * d'une ligne vide d'affilée.
 */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Nombre de caractères « utiles » (hors espaces) — sert à détecter un PDF scanné. */
export function meaningfulLength(text: string): number {
  return text.replace(/\s+/g, "").length;
}
