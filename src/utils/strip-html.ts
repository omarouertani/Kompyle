// Dependency-free inline-HTML helpers, safe to import from client components
// (the canvas) without pulling react-pdf into the bundle. `inline-html.ts`
// re-exports these for the PDF side.

/** Inline tags the canvas editor can emit (B/I/U/S, color/size/font spans,
 *  alignment divs, legacy <font>). */
const INLINE_TAG_RE = /<\/?(?:a|b|strong|i|em|u|s|strike|span|div|p|font|br|ul|ol|li)[\s/>]/i;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'",
};

/** Decodes HTML entities in ONE pass (so `&amp;lt;` stays `&lt;`): numeric
 *  (`&#233;`, `&#xE9;`) and the common named ones. Unknown or invalid
 *  entities are left as is. */
export function decodeEntities(text: string): string {
  if (!text || !text.includes("&")) return text;
  return text.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return match;
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Builds a download-safe file name stem from CV fields: strips inline HTML,
 *  drops characters forbidden on Windows/macOS (`\ / : * ? " < > |`), turns
 *  whitespace into `_` and joins the non-empty parts with `_`.
 *  `safeFileName(["CV", "<b>Dev</b> / Ops"])` → `"CV_Dev_Ops"`. */
export function safeFileName(parts: string[]): string {
  return parts
    .map((p) => stripHtml(p ?? "").replace(/[\\/:*?"<>|]+/g, " ").trim().replace(/\s+/g, "_"))
    .filter(Boolean)
    .join("_");
}

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
  return decodeEntities(
    text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li(?:\s[^>]*)?>/gi, "• ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/?(?:a|b|strong|i|em|u|s|strike|span|div|p|font|ul|ol)(?:\s[^>]*)?>/gi, ""),
  );
}
