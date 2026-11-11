import { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { buildFieldExtensions, CSS_TO_TEXT_STYLE_ATTR } from "./extensions";
import { editorHtmlToStored, storedToEditorHtml } from "./stored-html";
import type { FormatCommand, FormatState, RichEditorHandle } from "../format-types";

/* ────────────────────────────────────────────────────────────────────────────
 * Mini-éditeur TipTap d'UN champ du canvas, créé au focus et détruit quand un
 * autre champ prend la main : jamais plus d'un éditeur vivant, quel que soit le
 * nombre de champs. Hors édition, le champ reste un span statique.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface FieldEditorOptions {
  /** Span hôte : l'éditeur ProseMirror y est monté (son contenu est remplacé). */
  host: HTMLElement;
  value: string;
  multiline: boolean;
  /** Texte indicatif affiché tant que le champ est vide (aussi pendant l'édition). */
  placeholder?: string;
  /** Caret / sélection à restaurer, en caractères depuis le début du texte. */
  caret?: { anchor: number; head: number } | null;
  onUpdate: () => void;
  onSelectionChange: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

/** Position ProseMirror du n-ième caractère du texte (sauts de bloc ignorés,
 *  comme `Range.toString()` sur le span statique). */
function posFromTextOffset(doc: PmNode, target: number): number {
  let acc = 0;
  let found = -1;
  doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.isText) {
      const len = node.text?.length ?? 0;
      if (acc + len >= target) {
        found = pos + (target - acc);
        return false;
      }
      acc += len;
    }
    return true;
  });
  return found;
}

/** Caret actuel du span statique, en caractères (null si hors du span). */
export function readTextCaret(host: HTMLElement): { anchor: number; head: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !host.contains(sel.anchorNode)) return null;
  const offsetOf = (node: Node, offset: number) => {
    const r = document.createRange();
    r.selectNodeContents(host);
    try {
      r.setEnd(node, offset);
    } catch {
      return 0;
    }
    return r.toString().length;
  };
  const anchor = offsetOf(sel.anchorNode, sel.anchorOffset);
  const head = sel.focusNode && host.contains(sel.focusNode) ? offsetOf(sel.focusNode, sel.focusOffset) : anchor;
  return { anchor, head };
}

/**
 * Filet de sécurité : ProseMirror ignore parfois la sélection posée par le
 * navigateur (double-clic sur un mot déjà sélectionné juste avant : son cache
 * de sélection DOM la croit inchangée). Le DOM montre alors le mot sélectionné
 * mais l'état garde l'ancien caret, et le bouton suivant (lien, couleur…)
 * s'appliquerait au mauvais endroit. On recopie donc la sélection DOM dans
 * l'état si elle diffère : après chaque changement de sélection et juste avant
 * chaque commande de la barre d'outils.
 */
function syncDomSelection(editor: Editor) {
  const doc = editor.view.dom.ownerDocument;
  if (editor.isDestroyed || editor.view.composing || !editor.view.hasFocus()) return;
  const sel = doc.getSelection();
  const dom = editor.view.dom;
  if (!sel?.anchorNode || !sel.focusNode || !dom.contains(sel.anchorNode) || !dom.contains(sel.focusNode)) return;
  let anchor: number;
  let head: number;
  try {
    anchor = editor.view.posAtDOM(sel.anchorNode, sel.anchorOffset);
    head = editor.view.posAtDOM(sel.focusNode, sel.focusOffset);
  } catch {
    return;
  }
  const cur = editor.state.selection;
  // Sélection non textuelle (Ctrl+A → AllSelection) : celle de ProseMirror fait foi.
  if (!(cur instanceof TextSelection) || (cur.anchor === anchor && cur.head === head)) return;
  const next = TextSelection.between(editor.state.doc.resolve(anchor), editor.state.doc.resolve(head));
  if (next.anchor === cur.anchor && next.head === cur.head) return;
  editor.view.dispatch(editor.state.tr.setSelection(next));
}

function watchDomSelection(editor: Editor) {
  const doc = editor.view.dom.ownerDocument;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const sync = () => {
    timer = null;
    syncDomSelection(editor);
  };
  // Après le traitement de ProseMirror (il lit la sélection juste après l'événement).
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(sync, 30);
  };
  doc.addEventListener("selectionchange", schedule);
  doc.addEventListener("mouseup", schedule, true);
  editor.on("destroy", () => {
    if (timer) clearTimeout(timer);
    doc.removeEventListener("selectionchange", schedule);
    doc.removeEventListener("mouseup", schedule, true);
  });
}

export function createFieldEditor(opts: FieldEditorOptions): Editor {
  opts.host.innerHTML = "";
  let editor: Editor | null = null;
  editor = new Editor({
    element: opts.host,
    content: storedToEditorHtml(opts.value),
    extensions: buildFieldExtensions({
      multiline: opts.multiline,
      onSingleLineEnter: () => editor?.view.dom.blur(),
    }),
    injectCSS: true,
    // Données venant de l'IA ou de vieux HTML : jamais d'erreur bloquante.
    enableContentCheck: false,
    editorProps: {
      // Un 2e espace consécutif est ignoré : le span statique et le PDF n'en
      // montrent qu'un (l'éditeur, en `pre-wrap`, les afficherait tous).
      handleTextInput: (view, from, to, text) => {
        if (!text.includes(" ")) return false;
        const { doc } = view.state;
        const before = from > 1 ? doc.textBetween(from - 1, from) : "";
        const after = to < doc.content.size - 1 ? doc.textBetween(to, to + 1) : "";
        let next = text.replace(/ {2,}/g, " ");
        if (before === " ") next = next.replace(/^ /, "");
        if (after === " ") next = next.replace(/ $/, "");
        if (next === text) return false;
        if (next || from !== to) view.dispatch(view.state.tr.insertText(next, from, to));
        return true;
      },
      // Recalculés à chaque transaction : `data-empty` affiche le texte
      // indicatif (CSS `.kompyle-field-editor[data-empty]::before`).
      attributes: (state) => {
        const { doc } = state;
        const empty = doc.childCount === 1 && doc.firstChild!.isTextblock && doc.firstChild!.content.size === 0;
        return {
          class: "kompyle-field-editor outline-none",
          spellcheck: "false",
          ...(empty && opts.placeholder ? { "data-empty": "", "data-placeholder": opts.placeholder } : {}),
        };
      },
    },
    onUpdate: opts.onUpdate,
    onSelectionUpdate: opts.onSelectionChange,
    onFocus: opts.onFocus,
    onBlur: opts.onBlur,
  });
  watchDomSelection(editor);
  // Caret au même caractère que dans le span statique ; sinon en fin de texte.
  const { caret } = opts;
  const doc = editor.state.doc;
  const anchor = caret ? posFromTextOffset(doc, caret.anchor) : -1;
  const head = caret ? posFromTextOffset(doc, caret.head) : -1;
  if (anchor >= 0 && head >= 0) editor.commands.setTextSelection({ from: anchor, to: head });
  else editor.commands.setTextSelection(doc.content.size);
  // Pas de focus ici : l'appelant enregistre d'abord l'éditeur (le blur du span
  // hôte part pendant le focus et doit voir l'éditeur déjà en place).
  return editor;
}

/** Valeur à stocker pour le contenu actuel de l'éditeur. */
export function readStoredValue(editor: Editor): string {
  return editorHtmlToStored(editor.getHTML(), editor.getText({ blockSeparator: "\n" }));
}

const isBoldWeight = (v: string) => /^(bold(er)?|[7-9]00)$/i.test(v);

/** Style calculé du texte au caret (taille / police / graisse héritées du bloc). */
function caretComputedStyle(editor: Editor): CSSStyleDeclaration | null {
  try {
    const { node, offset } = editor.view.domAtPos(editor.state.selection.from);
    let el: Element | null = null;
    if (node.nodeType === Node.TEXT_NODE) el = node.parentElement;
    else {
      const child = (node as Element).childNodes[offset] ?? (node as Element).childNodes[offset - 1];
      el = child && child.nodeType === Node.ELEMENT_NODE ? (child as Element) : child?.parentElement ?? (node as Element);
    }
    return el ? window.getComputedStyle(el) : null;
  } catch {
    return null;
  }
}

/** Objet de commande enregistré auprès du CanvasFormatProvider. */
export function createEditorHandle(editor: Editor, deactivate: () => void): RichEditorHandle {
  const readState = (): FormatState => {
    const sel = editor.state.selection;
    const ts = editor.getAttributes("textStyle") as Record<string, string | null | undefined>;
    const para = editor.getAttributes("paragraph") as { textAlign?: string | null };
    const cs = caretComputedStyle(editor);
    const markBold = editor.isActive("bold");
    const weight = ts.fontWeight ?? "";
    const computedWeight = cs ? parseInt(cs.fontWeight, 10) : NaN;
    const semibold = !markBold && (/^(semibold|[56]00)$/i.test(weight) || (!weight && computedWeight >= 500 && computedWeight < 700));
    const px = cs ? parseFloat(cs.fontSize) : NaN;
    const align = para.textAlign;
    return {
      bold: markBold || (!semibold && weight !== "normal" && computedWeight >= 700),
      semibold,
      italic: editor.isActive("italic"),
      underline: editor.isActive("underline"),
      strike: editor.isActive("strike"),
      align: align === "center" || align === "right" || align === "justify" ? align : "left",
      textColor: ts.color || cs?.color || null,
      fontFamily: cs?.fontFamily || null,
      fontSize: Number.isFinite(px) ? Math.round(px * 0.75 * 2) / 2 : null,
      hasSelection: editor.isFocused && !sel.empty,
      hasActiveEditor: true,
    };
  };

  const exec = (command: FormatCommand, value?: string): boolean => {
    syncDomSelection(editor);
    const c = editor.chain().focus();
    switch (command) {
      case "bold": return c.toggleMark("bold").run();
      case "italic": return c.toggleItalic().run();
      case "underline": return c.toggleUnderline().run();
      case "strikeThrough": return c.toggleStrike().run();
      case "foreColor": return value ? c.setMark("textStyle", { color: value }).run() : false;
      case "hiliteColor":
        return c.setMark("textStyle", { backgroundColor: value && value !== "transparent" ? value : null }).removeEmptyTextStyle().run();
      case "createLink": {
        if (!value) return false;
        if (editor.state.selection.empty) {
          return c.insertContent({ type: "text", text: value, marks: [{ type: "link", attrs: { href: value } }] }).run();
        }
        return c.extendMarkRange("link").setLink({ href: value }).run();
      }
      case "unlink": return c.extendMarkRange("link").unsetLink().run();
      case "justifyLeft": return c.setTextAlign("left").run();
      case "justifyCenter": return c.setTextAlign("center").run();
      case "justifyRight": return c.setTextAlign("right").run();
      case "justifyFull": return c.setTextAlign("justify").run();
      case "removeFormat": return c.unsetAllMarks().run();
      case "insertUnorderedList": return c.toggleBulletList().run();
      case "insertOrderedList": return c.toggleOrderedList().run();
      default: return false;
    }
  };

  const applyStyles = (styles: Record<string, string>): boolean => {
    syncDomSelection(editor);
    const c = editor.chain().focus();
    // Caret sans sélection → tout le champ (comportement de l'ancien éditeur).
    if (editor.state.selection.empty) c.selectAll();
    const attrs: Record<string, string | null> = {};
    let touched = false;
    for (const [prop, val] of Object.entries(styles)) {
      if (prop === "font-weight") {
        touched = true;
        if (isBoldWeight(val)) {
          c.setMark("bold");
          attrs.fontWeight = null;
        } else {
          c.unsetMark("bold");
          attrs.fontWeight = /^(normal|[1-4]00)$/i.test(val) ? null : val;
        }
        continue;
      }
      const key = CSS_TO_TEXT_STYLE_ATTR[prop];
      if (!key) continue;
      attrs[key] = val;
      touched = true;
    }
    if (!touched) return false;
    return c.setMark("textStyle", attrs).removeEmptyTextStyle().run();
  };

  return { dom: editor.view.dom as HTMLElement, exec, applyStyles, readState, deactivate };
}
