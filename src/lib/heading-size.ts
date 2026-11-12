/**
 * Taille d'UN titre de section, portée par son propre texte (style inline
 * `font-size: …pt`, déjà compris par le canvas et par le rendu PDF). La taille
 * de TOUS les titres reste réglable dans le panneau Thème (`theme.headingSize`).
 */

const FONT_SIZE_RE = /font-size\s*:\s*([\d.]+)\s*pt/i;

/** Taille propre du titre, sinon celle du thème. */
export function headingSizeOf(title: string, themeSize: number): number {
  const m = FONT_SIZE_RE.exec(title || "");
  const v = m ? parseFloat(m[1]) : NaN;
  return Number.isFinite(v) ? v : themeSize;
}

/** Retire tout `font-size` du titre, puis les `<span>` devenus vides d'attributs. */
function stripFontSize(html: string): string {
  let out = html.replace(/style\s*=\s*"([^"]*)"/gi, (_m, decls: string) => {
    const cleaned = decls.replace(/font-size\s*:[^;"]*;?/gi, "").replace(/^\s*;|;\s*$/g, "").trim();
    return cleaned ? `style="${cleaned}"` : "";
  });
  // Un <span> sans attribut n'a plus d'effet : on le déballe (évite l'empilement
  // de spans à chaque clic sur −/+).
  let prev: string;
  do {
    prev = out;
    out = out.replace(/<span\s*>([\s\S]*?)<\/span>/gi, "$1");
  } while (out !== prev);
  return out;
}

/** Fixe la taille de CE titre (en pt). */
export function withHeadingSize(title: string, pt: number): string {
  const base = stripFontSize(title || "");
  return `<span style="font-size: ${pt}pt">${base}</span>`;
}
