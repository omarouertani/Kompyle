import { resolvePdfFontFromCss } from "./pdf-fonts";
import { stripHtml, hasInlineHtml } from "./strip-html";

// Pure (JSX-free) inline-HTML parsing shared by the PDF primitives and the
// rich-text helpers. Kept in its own module so the <Text>/<Link> primitives can
// auto-render formatting WITHOUT importing pdf-text-utils (which imports the
// primitives — that would be a circular dependency).
//
// `stripHtml`/`hasInlineHtml` live in the dependency-free `strip-html.ts` so
// client components (the canvas) can use them without pulling in react-pdf.
export { stripHtml, hasInlineHtml };

export interface InlineStyle {
  fontWeight?: "bold";
  fontStyle?: "italic";
  textDecoration?: "underline" | "line-through" | "underline line-through";
  color?: string;
  fontFamily?: string;
  letterSpacing?: number;
  fontSize?: number;
  backgroundColor?: string;
}

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

/** Minimal HTML → run parser over the controlled subset execCommand produces. */
export function parseInlineHtml(html: string): RichTextRun[] {
  if (!html) return [];
  if (!/[<&]/.test(html)) return [{ text: html }];

  const runs: RichTextRun[] = [];
  const stack: InlineStyle[] = [{}];
  const mergeStyle = (): InlineStyle => stack.reduce<InlineStyle>((acc, s) => ({ ...acc, ...s }), {});

  const push = (text: string) => {
    if (!text) return;
    const decoded = text
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#39;/gi, "'");
    runs.push({ text: decoded, style: mergeStyle() });
  };

  const tagRe = /<\/?(b|strong|i|em|u|s|strike|span|div|p|font|br)(?:\s+([^>]*))?\s*\/?>/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    if (m.index > lastIndex) push(html.slice(lastIndex, m.index));
    const tag = m[1].toLowerCase();
    const attrs = m[2] ?? "";
    const isClose = m[0].startsWith("</");
    if (tag === "br") {
      runs.push({ text: "\n", style: mergeStyle() });
    } else if (isClose) {
      if (stack.length > 1) stack.pop();
    } else {
      const style: InlineStyle = {};
      if (tag === "b" || tag === "strong") style.fontWeight = "bold";
      if (tag === "i" || tag === "em") style.fontStyle = "italic";
      if (tag === "u") style.textDecoration = "underline";
      if (tag === "s" || tag === "strike") {
        style.textDecoration = style.textDecoration === "underline"
          ? "underline line-through"
          : "line-through";
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
            if (/bold|[6-9]\d\d/.test(val)) style.fontWeight = "bold";
          } else if (prop === "font-style") {
            if (val.includes("italic")) style.fontStyle = "italic";
          } else if (prop === "text-decoration" || prop === "text-decoration-line") {
            const hasU = /underline/i.test(val);
            const hasS = /line-through/i.test(val);
            style.textDecoration = hasU && hasS
              ? "underline line-through"
              : hasU ? "underline" : hasS ? "line-through" : style.textDecoration;
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

/** Maps a parsed inline style to a react-pdf style object, resolving the
 *  fontFamily CSS stack to a registered PDF font. */
export function toPdfRunStyle(s: InlineStyle): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (s.fontWeight) out.fontWeight = s.fontWeight;
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
