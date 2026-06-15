// Dependency-free inline-HTML helpers, safe to import from client components
// (the canvas) without pulling react-pdf into the bundle. `inline-html.ts`
// re-exports these for the PDF side.

/** Inline tags the canvas editor can emit (B/I/U/S, color/size/font spans,
 *  alignment divs, legacy <font>). */
const INLINE_TAG_RE = /<\/?(?:b|strong|i|em|u|s|strike|span|div|p|font|br)[\s/>]/i;

/** True when a string contains markup we should parse (not just a stray `<`). */
export function hasInlineHtml(text: string): boolean {
  return !!text && INLINE_TAG_RE.test(text);
}

/** Strips inline format tags and decodes the common HTML entities. Used both
 *  as the PDF safe-fallback and to show a clean label in the canvas (hover
 *  tooltip / selection info bar) for a section title that carries formatting. */
export function stripHtml(text: string): string {
  if (!text) return "";
  if (!/[<&]/.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:b|strong|i|em|u|s|strike|span|div|p|font)(?:\s[^>]*)?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}
