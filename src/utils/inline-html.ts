import { resolvePdfFontFromCss } from "./pdf-fonts";
import { stripHtml, hasInlineHtml, decodeEntities } from "./strip-html";

// Pure (JSX-free) inline-HTML parsing shared by the PDF primitives and the
// rich-text helpers. Kept in its own module so the <Text>/<Link> primitives can
// auto-render formatting WITHOUT importing pdf-text-utils (which imports the
// primitives — that would be a circular dependency).
//
// `stripHtml`/`hasInlineHtml` live in the dependency-free `strip-html.ts` so
// client components (the canvas) can use them without pulling in react-pdf.
export { stripHtml, hasInlineHtml };

export type RichTextAlign = "left" | "center" | "right" | "justify";

export interface InlineStyle {
  /** "semibold" = CSS 500-600 (rendered with the 600 face when the font ships
   *  one, else react-pdf falls back to 700). 700+ stays "bold". */
  fontWeight?: "bold" | "semibold" | "normal";
  fontStyle?: "italic" | "normal";
  textDecoration?: "underline" | "line-through" | "underline line-through" | "none";
  /** Paragraph alignment (from `text-align` / `align=` on div/p). Never emitted
   *  on a run: react-pdf only honours it on the parent <Text> — see
   *  `detectRichAlign`. */
  textAlign?: RichTextAlign;
  /** Paragraph line height as a multiplier (from `line-height`). Like
   *  `textAlign`, only honoured on the parent <Text> — see `detectRichLineHeight`. */
  lineHeight?: number;
  color?: string;
  fontFamily?: string;
  letterSpacing?: number;
  fontSize?: number;
  backgroundColor?: string;
  /** Link target (`<a href>`), kept only for http(s)/mailto/tel. Rendered as a
   *  react-pdf <Link> by the primitives, never passed as a style. */
  href?: string;
}

const SAFE_HREF_RE = /^(https?:|mailto:|tel:)/i;

export interface RichTextRun {
  text: string;
  style?: InlineStyle;
}

/** Parse a length (`12pt`, `16px`, `1.5em`, `14`) into points. Unitless = pt. */
function parseLengthToPt(raw: string): number | undefined {
  const m = /^\s*([\d.]+)\s*(pt|px|em|rem)?\s*$/i.exec(raw);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return undefined;
  const unit = (m[2] ?? "pt").toLowerCase();
  if (unit === "pt") return n;
  if (unit === "px") return n * 0.75; // 1px = 0.75pt
  if (unit === "em" || unit === "rem") return n * 12; // approximate vs theme default
  return n;
}

function parseTextAlign(raw: string): RichTextAlign | undefined {
  const v = raw.trim().toLowerCase();
  if (v === "left" || v === "start") return "left";
  if (v === "right" || v === "end") return "right";
  if (v === "center") return "center";
  if (v === "justify") return "justify";
  return undefined;
}

/** Minimal HTML → run parser over the controlled subset the canvas editor
 *  produces (and older contentEditable / execCommand values). */
export function parseInlineHtml(html: string): RichTextRun[] {
  if (!html) return [];
  if (!/[<&]/.test(html)) return [{ text: html }];

  const runs: RichTextRun[] = [];
  const stack: InlineStyle[] = [{}];
  // Decorations are cumulative (`<s><u>x</u></s>` = underline + line-through)
  // and `text-decoration: none` clears what the ancestors set, so they can't
  // be merged with a plain "last wins" spread like the other props.
  const mergeStyle = (): InlineStyle => {
    const acc: InlineStyle = {};
    let underline = false;
    let strike = false;
    let sawNone = false;
    for (const { textDecoration, ...rest } of stack) {
      Object.assign(acc, rest);
      if (textDecoration === "none") {
        underline = false;
        strike = false;
        sawNone = true;
      } else if (textDecoration) {
        if (textDecoration.includes("underline")) underline = true;
        if (textDecoration.includes("line-through")) strike = true;
      }
    }
    const decoration: InlineStyle["textDecoration"] = underline && strike
      ? "underline line-through"
      : underline ? "underline" : strike ? "line-through" : sawNone ? "none" : undefined;
    if (decoration) acc.textDecoration = decoration;
    return acc;
  };

  const push = (text: string) => {
    if (!text) return;
    runs.push({ text: decodeEntities(text), style: mergeStyle() });
  };

  // Open lists, innermost last: <ol> numbers its items, <ul> uses bullets.
  const lists: { ordered: boolean; n: number }[] = [];

  const tagRe = /<\/?(a|b|strong|i|em|u|s|strike|span|div|p|font|br|ul|ol|li)(?:\s+([^>]*))?\s*\/?>/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m.index > lastIndex) push(html.slice(lastIndex, m.index));
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? "";
    const isClose = m[0].startsWith("</");
    if (tag === "br") {
      runs.push({ text: "\n", style: mergeStyle() });
    } else if (tag === "ul" || tag === "ol") {
      // Conteneurs de liste : aucun style propre, mais on pousse/dépile pour
      // garder la pile équilibrée avec les <span> internes.
      if (isClose) {
        lists.pop();
        if (stack.length > 1) stack.pop();
      } else {
        lists.push({ ordered: tag === "ol", n: 0 });
        stack.push({});
      }
    } else if (tag === "li") {
      // Puce avant chaque item, saut de ligne à la fermeture → rendu PDF
      // identique au canvas (où <li> s'affiche comme une liste à puces).
      if (isClose) {
        runs.push({ text: "\n", style: mergeStyle() });
        if (stack.length > 1) stack.pop();
      } else {
        stack.push({});
        const list = lists[lists.length - 1];
        const marker = list?.ordered ? `${++list.n}. ` : "• ";
        runs.push({ text: marker, style: mergeStyle() });
      }
    } else if (isClose) {
      if (stack.length > 1) stack.pop();
    } else {
      // Les éléments de bloc (div/p) que produit contentEditable pour chaque
      // nouvelle ligne n'introduisaient AUCUN séparateur → les lignes d'un champ
      // multi-ligne fusionnaient dans le PDF. On insère un saut de ligne avant un
      // bloc ouvrant dès qu'un contenu précède (jamais devant le tout premier).
      if ((tag === "div" || tag === "p") && runs.length > 0) {
        runs.push({ text: "\n", style: mergeStyle() });
      }
      const style: InlineStyle = {};
      if (tag === "b" || tag === "strong") style.fontWeight = "bold";
      if (tag === "i" || tag === "em") style.fontStyle = "italic";
      if (tag === "u") style.textDecoration = "underline";
      if (tag === "s" || tag === "strike") style.textDecoration = "line-through";
      if (tag === "a") {
        const hrefAttr = /(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
        const href = hrefAttr ? decodeEntities(hrefAttr[1] ?? hrefAttr[2] ?? "").trim() : "";
        if (SAFE_HREF_RE.test(href)) style.href = href;
      }
      // Legacy <font color="…" face="…">.
      if (tag === "font") {
        const colorAttr = /color\s*=\s*"?([^"\s>]+)/i.exec(attrs);
        const faceAttr = /face\s*=\s*"?([^"\s>]+)/i.exec(attrs);
        if (colorAttr) style.color = colorAttr[1];
        if (faceAttr) style.fontFamily = faceAttr[1].replace(/['"]/g, "");
      }
      // span/div/p: read the style="…" attribute (property captured first so
      // background-color isn't mis-parsed as color).
      if (tag === "div" || tag === "p") {
        const alignAttr = /(?:^|\s)align\s*=\s*["']?([a-z]+)/i.exec(attrs);
        const align = alignAttr ? parseTextAlign(alignAttr[1]) : undefined;
        if (align) style.textAlign = align;
      }
      if (tag === "span" || tag === "div" || tag === "p") {
        const styleMatch = /style\s*=\s*"([^"]*)"/i.exec(attrs);
        const styleStr = styleMatch?.[1] ?? "";
        const re = /([a-z-]+)\s*:\s*([^;]+?)(?:;|$)/gi;
        let p: RegExpExecArray | null;
        while ((p = re.exec(styleStr)) !== null) {
          const prop = p[1].toLowerCase();
          const val = p[2].trim();
          if (prop === "color") style.color = val;
          else if (prop === "background-color") style.backgroundColor = val;
          else if (prop === "font-family") style.fontFamily = val.replace(/['"]/g, "");
          else if (prop === "font-size") {
            const n = parseLengthToPt(val);
            if (n !== undefined) style.fontSize = n;
          } else if (prop === "letter-spacing") {
            const n = parseLengthToPt(val);
            if (n !== undefined) style.letterSpacing = n;
          } else if (prop === "font-weight") {
            if (/^(bold|bolder|[7-9]00)$/i.test(val)) style.fontWeight = "bold";
            else if (/^(semibold|[56]00)$/i.test(val)) style.fontWeight = "semibold";
            else if (/^(normal|lighter|[1-4]00)$/i.test(val)) style.fontWeight = "normal";
          } else if (prop === "font-style") {
            if (/^(italic|oblique)\b/i.test(val)) style.fontStyle = "italic";
            else if (/^normal$/i.test(val)) style.fontStyle = "normal";
          } else if (prop === "text-decoration" || prop === "text-decoration-line") {
            const hasU = /underline/i.test(val);
            const hasS = /line-through/i.test(val);
            if (hasU && hasS) style.textDecoration = "underline line-through";
            else if (hasU) style.textDecoration = "underline";
            else if (hasS) style.textDecoration = "line-through";
            else if (/^none\b/i.test(val)) style.textDecoration = "none";
          } else if (prop === "text-align") {
            const align = parseTextAlign(val);
            if (align) style.textAlign = align;
          } else if (prop === "line-height") {
            const lh = parseLineHeight(val);
            if (lh !== undefined) style.lineHeight = lh;
          }
        }
      }
      stack.push(style);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < html.length) push(html.slice(lastIndex));
  return runs;
}

/**
 * Paragraph alignment carried by inline HTML (e.g. the editor's "center" alignment
 * writes `<p style="text-align: center">…</p>`, older values a `<div>`). react-pdf only applies
 * `textAlign` on the parent <Text>, not on a nested run, so the primitives read
 * it here and set it on the outer <Text>.
 * Known limit: when a field holds several paragraphs with different
 * alignments, the first aligned paragraph wins for the whole field.
 */
export function detectRichAlign(html: string): RichTextAlign | undefined {
  if (!html || !/<(div|p)\b/i.test(html)) return undefined;
  for (const run of parseInlineHtml(html)) {
    if (run.style?.textAlign) return run.style.textAlign;
  }
  return undefined;
}

/** `line-height` → multiplier. Accepts unitless numbers (`1.5`) and
 *  percentages (`150%`); absolute lengths are ignored (they depend on the
 *  font size and would clip descenders under `overflow: hidden`). Clamped to a
 *  readable range. */
function parseLineHeight(raw: string): number | undefined {
  const m = /^\s*([\d.]+)\s*(%)?\s*$/.exec(raw);
  if (!m) return undefined;
  let n = parseFloat(m[1]);
  if (Number.isNaN(n)) return undefined;
  if (m[2]) n /= 100;
  if (n < 0.8 || n > 3) return undefined;
  return Math.round(n * 100) / 100;
}

/**
 * Line height carried by inline HTML (the toolbar wraps the text in
 * `<span style="line-height: 1.5">`). Same rule as `detectRichAlign`: react-pdf
 * applies it on the parent <Text>, so the first value found wins for the field.
 */
export function detectRichLineHeight(html: string): number | undefined {
  if (!html || !/line-height/i.test(html)) return undefined;
  for (const run of parseInlineHtml(html)) {
    if (run.style?.lineHeight !== undefined) return run.style.lineHeight;
  }
  return undefined;
}

/** Maps a parsed inline style to a react-pdf style object, resolving the
 *  fontFamily CSS stack to a registered PDF font. */
export function toPdfRunStyle(s: InlineStyle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.fontWeight) out.fontWeight = s.fontWeight === "semibold" ? 600 : s.fontWeight;
  if (s.fontStyle) out.fontStyle = s.fontStyle;
  if (s.textDecoration) out.textDecoration = s.textDecoration;
  if (s.color) out.color = s.color;
  if (s.backgroundColor) out.backgroundColor = s.backgroundColor;
  if (s.fontSize !== undefined) out.fontSize = s.fontSize;
  if (s.letterSpacing !== undefined) out.letterSpacing = s.letterSpacing;
  if (s.fontFamily) {
    const resolved = resolvePdfFontFromCss(s.fontFamily);
    if (resolved) out.fontFamily = resolved;
  }
  return out;
}

/** Text-level keys cascaded from the block style into each run (react-pdf does
 *  not reliably inherit them). Layout props (margin/border/width) are excluded
 *  so an h2's underline border / spacing isn't duplicated onto every run. */
const INHERITABLE_TEXT_KEYS = [
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontFamily",
  "color",
  "textTransform",
  "letterSpacing",
  "lineHeight",
  "textDecoration",
] as const;

/** Flattens a react-pdf style (object or nested array) keeping only text props. */
export function inheritableTextStyle(style: unknown): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  const visit = (s: unknown) => {
    if (!s) return;
    if (Array.isArray(s)) { s.forEach(visit); return; }
    if (typeof s === "object") {
      for (const key of INHERITABLE_TEXT_KEYS) {
        const v = (s as Record<string, unknown>)[key];
        if (v !== undefined) flat[key] = v;
      }
    }
  };
  visit(style);
  return flat;
}
