import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { TextAlign } from "@tiptap/extension-text-align";

/* ────────────────────────────────────────────────────────────────────────────
 * Schéma TipTap des champs du canvas.
 *
 * Il ne couvre QUE le sous-ensemble HTML que lisent le parser PDF
 * (`src/utils/inline-html.ts`) et le sanitizer (`src/utils/sanitize-html.ts`) :
 * strong/em/u/s, span à style, p (text-align), a, ul/ol/li, br. La sortie de
 * `getHTML()` reste donc lisible par le PDF sans migration, et les valeurs déjà
 * stockées (spans, div, font, b/i) sont relues correctement.
 * ──────────────────────────────────────────────────────────────────────────── */

/** CSS (barre d'outils, `applyInlineStyle`) → attribut du mark `textStyle`. */
export const CSS_TO_TEXT_STYLE_ATTR: Record<string, string> = {
  color: "color",
  "background-color": "backgroundColor",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "font-weight": "fontWeight",
  "letter-spacing": "letterSpacing",
  "line-height": "lineHeight",
};

const isSafeCss = (v: unknown): v is string =>
  typeof v === "string" && v.trim() !== "" && !/url\s*\(|expression|javascript:|[<>;"]/i.test(v);

function rawStyleValue(style: string, prop: string): string {
  let found = "";
  for (const decl of style.split(";")) {
    const i = decl.indexOf(":");
    if (i > 0 && decl.slice(0, i).trim().toLowerCase() === prop) found = decl.slice(i + 1).trim();
  }
  return found;
}

/** Attribut de style d'un span : lu depuis `style` (ou un attribut legacy de
 *  `<font>`), écrit en `style="prop: valeur"`. */
function styleAttr(prop: string, legacyAttr?: string, normalize?: (v: string) => string | null) {
  return {
    default: null,
    parseHTML: (el: HTMLElement) => {
      // Valeur BRUTE de l'attribut (la dernière déclaration l'emporte) : `el.style`
      // normaliserait `#ff0000` en `rgb(255, 0, 0)`.
      const raw = rawStyleValue(el.getAttribute("style") ?? "", prop) || (legacyAttr ? el.getAttribute(legacyAttr) : null) || "";
      const v = raw.replace(/['"]+/g, "").trim();
      if (!v) return null;
      return normalize ? normalize(v) : v;
    },
    renderHTML: (attrs: Record<string, unknown>) => {
      const key = CSS_TO_TEXT_STYLE_ATTR[prop];
      const v = attrs[key];
      return isSafeCss(v) ? { style: `${prop}: ${v}` } : {};
    },
  };
}

/** Le gras « vrai » (bold, 700-900) est un mark `bold` ; 500/600 (semi-gras) et
 *  `normal` restent un attribut `fontWeight` du span. */
const normalizeWeight = (v: string): string | null => {
  if (/^(semibold|[56]00)$/i.test(v)) return v;
  if (/^(normal|lighter|[1-4]00)$/i.test(v)) return "normal";
  return null;
};

/** `textStyle` qui lit aussi `<font color face>` (anciennes valeurs execCommand). */
const KompyleTextStyle = TextStyle.extend({
  parseHTML() {
    const props = Object.keys(CSS_TO_TEXT_STYLE_ATTR);
    const hasOwnProp = (el: HTMLElement) => props.some((p) => rawStyleValue(el.getAttribute("style") ?? "", p));
    // Règle d'origine (fusion des styles des spans imbriqués) gardée, mais un
    // span sans propriété de `textStyle` (ex. `font-style: italic` → <em>) ne
    // crée pas de mark vide (sinon `<span>` nu dans la valeur stockée).
    const parentRules = (this.parent?.() ?? []).map((rule) => ({
      ...rule,
      getAttrs: (node: HTMLElement | string) => {
        const getAttrs = rule.getAttrs as ((n: HTMLElement | string) => Record<string, unknown> | false | null) | undefined;
        const res = typeof getAttrs === "function" ? getAttrs(node) : {};
        if (res === false || typeof node === "string") return res;
        return hasOwnProp(node) ? res : false;
      },
    }));
    return [...parentRules, { tag: "font", consuming: false, getAttrs: () => ({}) }];
  },
});

const TextStyleAttributes = Extension.create({
  name: "kompyleTextStyleAttributes",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          color: styleAttr("color", "color"),
          backgroundColor: styleAttr("background-color"),
          fontFamily: styleAttr("font-family", "face"),
          fontSize: styleAttr("font-size"),
          fontWeight: styleAttr("font-weight", undefined, normalizeWeight),
          letterSpacing: styleAttr("letter-spacing"),
          lineHeight: styleAttr("line-height"),
        },
      },
    ];
  },
});

/** Gras limité à bold / 700-900 : la règle d'origine de TipTap prend 500-900,
 *  ce qui transformerait le semi-gras stocké en `<strong>`. */
const KompyleBold = Mark.create({
  name: "bold",
  parseHTML() {
    return [
      { tag: "strong" },
      { tag: "b", getAttrs: (node) => (node as HTMLElement).style.fontWeight !== "normal" && null },
      { style: "font-weight=400", clearMark: (mark) => mark.type.name === this.name },
      { style: "font-weight", getAttrs: (value) => /^(bold(er)?|[7-9]\d{2})$/.test(value as string) && null },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["strong", mergeAttributes(HTMLAttributes), 0];
  },
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => this.editor.commands.toggleMark(this.name),
      "Mod-B": () => this.editor.commands.toggleMark(this.name),
    };
  },
});

/** Paragraphe qui lit aussi les `<div>` que l'ancien contentEditable créait à
 *  chaque retour à la ligne. */
const KompyleParagraph = Node.create({
  name: "paragraph",
  priority: 1000,
  group: "block",
  content: "inline*",
  parseHTML() {
    return [{ tag: "p" }, { tag: "div" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes), 0];
  },
});

/** Champ mono-ligne : Entrée quitte le champ (comme avant). */
function singleLineKeymap(onEnter: () => void) {
  return Extension.create({
    name: "kompyleSingleLine",
    priority: 1000,
    addKeyboardShortcuts() {
      const leave = () => {
        onEnter();
        return true;
      };
      return { Enter: leave, "Shift-Enter": leave, "Mod-Enter": leave };
    },
  });
}

export function buildFieldExtensions(opts: { multiline: boolean; onSingleLineEnter: () => void }) {
  return [
    StarterKit.configure({
      bold: false,
      paragraph: false,
      blockquote: false,
      code: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      dropcursor: false,
      gapcursor: false,
      trailingNode: false,
      // Pas d'historique TipTap : Ctrl+Z / Ctrl+Y restent sur la pile unifiée
      // du canvas (use-undo-redo + use-keyboard-shortcuts).
      undoRedo: false,
      link: {
        openOnClick: false,
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: { target: null, rel: null, class: null },
      },
    }),
    KompyleParagraph,
    KompyleBold,
    KompyleTextStyle,
    TextStyleAttributes,
    TextAlign.configure({ types: ["paragraph"] }),
    ...(opts.multiline ? [] : [singleLineKeymap(opts.onSingleLineEnter)]),
  ];
}
