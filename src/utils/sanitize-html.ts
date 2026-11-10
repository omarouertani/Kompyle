// Strict allowlist sanitizer for the inline rich-text the canvas editor stores
// and injects via innerHTML. Without this, a malicious job posting could push
// executable HTML (e.g. `<img src=x onerror=…>`) through the AI into a CV field
// that EditableText later injects with innerHTML — a stored-XSS vector.
//
// The allowlist is deliberately aligned with `inline-html.ts` (the PDF parser):
// only the formatting tags/attributes the editor legitimately produces survive.
// Everything else is unwrapped (its safe text is kept) or, for dangerous
// containers, dropped with its content.

/** Formatting tags the editor emits and the PDF pipeline understands. */
const ALLOWED_TAGS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike",
  "span", "div", "p", "br", "ul", "ol", "li", "font", "a",
]);

/** Link protocols kept on `<a href>` (same rule as the PDF parser). */
const SAFE_HREF_RE = /^(https?:|mailto:|tel:)/i;

/** Tags whose *content* must be discarded entirely (never unwrapped). */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "noscript", "template", "iframe", "object",
  "embed", "svg", "math", "link", "meta", "base", "form", "input",
  "textarea", "button", "img", "video", "audio", "source",
]);

/** CSS properties allowed inside a `style="…"` attribute (safe, text-level). */
const ALLOWED_STYLE_PROPS = new Set([
  "color", "background-color", "font-family", "font-size", "font-weight",
  "font-style", "text-decoration", "text-decoration-line", "letter-spacing",
  "text-align",
]);

/** Rejects a CSS value that could smuggle a URL, JS, or markup. */
function isDangerousCssValue(value: string): boolean {
  return /url\s*\(|expression|javascript:|@import|[<>]/i.test(value);
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Keeps only allowed, non-dangerous style declarations. */
function sanitizeStyle(styleStr: string): string {
  const out: string[] = [];
  for (const decl of styleStr.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!prop || !val) continue;
    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (isDangerousCssValue(val)) continue;
    out.push(`${prop}: ${val}`);
  }
  return out.join("; ");
}

/** Serializes the safe attributes of an allowed element. */
function safeAttributes(el: Element, tag: string): string {
  if (tag === "font") {
    let s = "";
    const color = el.getAttribute("color");
    const face = el.getAttribute("face");
    if (color && !isDangerousCssValue(color)) s += ` color="${escapeAttr(color)}"`;
    if (face && !isDangerousCssValue(face)) s += ` face="${escapeAttr(face)}"`;
    return s;
  }
  if (tag === "a") {
    const href = (el.getAttribute("href") ?? "").trim();
    return SAFE_HREF_RE.test(href) ? ` href="${escapeAttr(href)}"` : "";
  }
  if (tag === "span" || tag === "div" || tag === "p") {
    const style = el.getAttribute("style");
    if (style) {
      const safe = sanitizeStyle(style);
      if (safe) return ` style="${escapeAttr(safe)}"`;
    }
  }
  return "";
}

function serializeChildren(parent: Node): string {
  let result = "";
  parent.childNodes.forEach((node) => {
    if (node.nodeType === 3 /* TEXT_NODE */) {
      result += escapeText(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== 1 /* ELEMENT_NODE */) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return; // drop element AND its content
    if (tag === "br") {
      result += "<br>";
      return;
    }
    const inner = serializeChildren(el);
    if (ALLOWED_TAGS.has(tag)) {
      result += `<${tag}${safeAttributes(el, tag)}>${inner}</${tag}>`;
    } else {
      result += inner; // unwrap unknown-but-harmless tags, keep their safe content
    }
  });
  return result;
}

/**
 * Returns a sanitized copy of `html` containing only the allowlisted inline
 * formatting. Plain strings (no tags) are returned unchanged. Safe to call on
 * every injection/commit — CV fields are small.
 *
 * On a non-DOM runtime (SSR) it falls back to stripping every tag, which is
 * safe but formatting-lossy; the canvas only ever injects on the client, so the
 * DOM path is what runs in practice.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html || !/[<]/.test(html)) return html; // no tags → nothing to sanitize
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }
  try {
    const doc = new window.DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
    const container = doc.body.firstElementChild;
    return container ? serializeChildren(container) : "";
  } catch {
    return html.replace(/<[^>]*>/g, "");
  }
}
