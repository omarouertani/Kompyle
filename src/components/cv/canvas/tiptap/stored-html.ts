import { sanitizeRichHtml } from "@/utils/sanitize-html";

/* Conversion entre la valeur STOCKÉE d'un champ (texte brut ou HTML inline lu
 * par le PDF) et le HTML de l'éditeur TipTap. Fonctions pures (chaînes). */

/** La valeur contient-elle de la mise en forme inline (balises reconnues) ?
 *  Texte brut → rendu via textContent (sûr) ; HTML → innerHTML assaini. */
export function isRichTextValue(v: string): boolean {
  return /<(b|i|u|s|strike|strong|em|span|div|p|font|a|ul|ol|li)[\s>/]/i.test(v);
}

/** Retire les blancs / `<br>` de début et de fin sans toucher aux balises. */
export function trimRich(v: string): string {
  return v.replace(/^(?:&nbsp;|\s|<br\s*\/?>)+/i, "").replace(/(?:&nbsp;|\s|<br\s*\/?>)+$/i, "").trim();
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Valeur stockée → contenu initial de l'éditeur. Le texte brut est échappé et
 *  ses retours à la ligne deviennent des `<br>` (sinon le parseur HTML les
 *  fusionnerait). */
export function storedToEditorHtml(value: string): string {
  if (!value) return "";
  if (isRichTextValue(value)) return sanitizeRichHtml(value);
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

// Contenu d'un élément qui ne contient pas lui-même de <p>.
const NO_P = "((?:(?!<\\/?p[\\s>])[\\s\\S])*?)";
const LI_SINGLE_P_RE = new RegExp(`<li><p(?:\\s[^>]*)?>${NO_P}<\\/p><\\/li>`, "gi");
const SINGLE_P_RE = new RegExp(`^<p>${NO_P}<\\/p>$`, "i");

/**
 * HTML de l'éditeur (`editor.getHTML()`) → valeur stockée, au format que le
 * PDF et les autres exports lisaient déjà :
 *  - `<li><p>x</p></li>` → `<li>x</li>` (sinon le PDF sauterait une ligne après
 *    la puce) ;
 *  - un seul paragraphe sans attribut → pas de `<p>` autour (champs d'une ligne
 *    inchangés) ;
 *  - sans balise de mise en forme → texte brut (`plainText`, retours à la ligne
 *    compris), comme l'ancien éditeur ;
 *  - sinon HTML assaini (défense en profondeur).
 */
export function editorHtmlToStored(html: string, plainText: string): string {
  let out = html.replace(LI_SINGLE_P_RE, "<li>$1</li>");
  const single = SINGLE_P_RE.exec(out);
  if (single) out = single[1];
  if (!out.trim()) return "";
  if (!isRichTextValue(out)) return plainText.trim();
  return trimRich(sanitizeRichHtml(out));
}
