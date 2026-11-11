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

/** Espaces comme les affichent le span statique (`white-space: normal`) et le
 *  PDF : insécables → espaces (un insécable brut fait échouer le rendu PDF),
 *  suites d'espaces → un seul. */
function normalizeSpaces(text: string): string {
  return text.replace(/\u00a0|&nbsp;/g, " ").replace(/ {2,}/g, " ");
}

/** Même chose dans du HTML, hors des balises. */
function normalizeSpacesInHtml(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") ? part : normalizeSpaces(part)))
    .join("");
}

/**
 * HTML de l'éditeur (`editor.getHTML()`) → valeur stockée, au format que le
 * PDF et les autres exports lisaient déjà :
 *  - `<li><p>x</p></li>` → `<li>x</li>` (sinon le PDF sauterait une ligne après
 *    la puce) ;
 *  - un seul paragraphe sans attribut → pas de `<p>` autour (champs d'une ligne
 *    inchangés) ;
 *  - sans balise de mise en forme → texte brut (`plainText`, retours à la ligne
 *    compris), comme l'ancien éditeur ;
 *  - sinon HTML assaini (défense en profondeur) ;
 *  - dans les deux cas, espaces normalisés (`normalizeSpaces`).
 */
export function editorHtmlToStored(html: string, plainText: string): string {
  let out = html.replace(LI_SINGLE_P_RE, "<li>$1</li>");
  const single = SINGLE_P_RE.exec(out);
  if (single) out = single[1];
  if (!out.trim()) return "";
  if (!isRichTextValue(out)) return normalizeSpaces(plainText).trim();
  return trimRich(sanitizeRichHtml(normalizeSpacesInHtml(out)));
}
