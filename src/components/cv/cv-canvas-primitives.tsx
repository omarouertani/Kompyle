"use client";

import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { PAGE_SIZES, type PageDims } from "@/lib/page-size";
import { cn } from "@/lib/utils";
import { useCanvasFormat } from "./canvas/use-canvas-format";
import { sanitizeRichHtml } from "@/utils/sanitize-html";
import { TYPING_COMMIT_IDLE_MS } from "./canvas/constants";
import type { Editor } from "@tiptap/core";
import type { RichEditorHandle } from "./canvas/format-types";
import { isRichTextValue, storedToEditorHtml, trimRich } from "./canvas/tiptap/stored-html";
import { createEditorHandle, createFieldEditor, readStoredValue, readTextCaret } from "./canvas/tiptap/field-editor";
import { isTiptapEditorEnabled } from "@/lib/feature-flags";

// Conversion EXACTE des points PDF (72 dpi) en pixels CSS (96 dpi) : 96/72.
// Le rendu PDF (react-pdf) place les blocs en points ; le canvas applique ce
// même facteur → un bloc à (x, y) pt tombe au même endroit dans les deux.
export const PT_TO_PX = 96 / 72;
// Dimensions NATIVES d'une page A4 PDF (595.28 × 841.89 pt) converties en
// pixels. La page du canvas a ainsi EXACTEMENT la taille d'une page PDF : ce
// que tu vois en édition correspond au rendu PDF final.
export const A4_WIDTH_PX = 595.28 * PT_TO_PX;  // ≈ 793.7
export const A4_HEIGHT_PX = 841.89 * PT_TO_PX; // ≈ 1122.5

/** Format de page actif du canvas (A4 par défaut, Letter possible), fourni par
 *  CVInteractiveCanvas à partir de `layout.pageSize`. */
export const PageDimsContext = createContext<PageDims>(PAGE_SIZES.A4);
export const usePageDims = () => useContext(PageDimsContext);

/** Couleur de sélection du canvas (indigo) — indépendante du thème du CV,
 *  pour rester lisible quelle que soit la couleur d'accent choisie. */
export const SELECTION_COLOR = "#6366f1";

export function ptsToPx(pts: number): string {
  return `${pts * PT_TO_PX}px`;
}

export type BlockPosition = { x: number; y: number; w: number };

interface CVPageScaleWrapperProps {
  children: React.ReactNode;
  zoom?: number;
  pageIndex?: number;
  onScaleChange?: (finalScale: number) => void;
  fitToContainer?: boolean;
  /** Hauteur minimale forcée du contenu (px, avant scale). */
  minContentHeightPx?: number;
}

/** Scales an A4 page to fit its container; reports combined scale for drag math. */
export function CVPageScaleWrapper({
  children,
  zoom = 1,
  pageIndex = 0,
  onScaleChange,
  fitToContainer = true,
  minContentHeightPx,
}: CVPageScaleWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const page = usePageDims();
  const PAGE_WIDTH_PX = page.widthPt * PT_TO_PX;
  const PAGE_HEIGHT_PX = page.heightPt * PT_TO_PX;
  const [baseScale, setBaseScale] = useState(1);
  const onScaleChangeRef = useRef(onScaleChange);
  useEffect(() => {
    onScaleChangeRef.current = onScaleChange;
  }, [onScaleChange]);

  const updateScale = useCallback(() => {
    const el = containerRef.current;
    if (!el?.parentElement) return;

    const parent = el.parentElement;
    // Largeur disponible : le scroll container a un p-4 (16px de chaque côté).
    const parentWidth = Math.max(200, parent.clientWidth - 32);
    // On ajuste UNIQUEMENT sur la largeur, exactement comme le viewer PDF de
    // l'iframe : ce qui dépasse en hauteur défile en scroll vertical natif.
    // Ajuster aussi sur la hauteur rapetissait la page par rapport au PDF
    // (perception de « page plus petite »).
    const scaleW = parentWidth / PAGE_WIDTH_PX;
    const nextBase = fitToContainer ? Math.min(1, scaleW) : 1;
    setBaseScale(nextBase);
    onScaleChangeRef.current?.(nextBase * zoom);
  }, [zoom, fitToContainer, PAGE_WIDTH_PX]);

  useEffect(() => {
    updateScale();
    const parent = containerRef.current?.parentElement;
    const ro = parent ? new ResizeObserver(updateScale) : null;
    if (parent && ro) ro.observe(parent);
    window.addEventListener("resize", updateScale);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [updateScale]);

  const finalScale = baseScale * zoom;
  const pageHeightPx = Math.max(PAGE_HEIGHT_PX, minContentHeightPx ?? PAGE_HEIGHT_PX);

  return (
    <div
      ref={containerRef}
      className="flex justify-center items-start py-2 shrink-0 w-full"
      style={{ height: `${pageHeightPx * finalScale + 24}px` }}
    >
      <div
        data-page-index={pageIndex}
        className="shadow-2xl border border-border/60 bg-white text-zinc-900 shrink-0 cv-a4-page relative mx-auto overflow-hidden"
        style={{
          width: `${PAGE_WIDTH_PX * finalScale}px`,
          height: `${pageHeightPx * finalScale}px`,
        }}
      >
        <div
          data-cv-page-content
          style={{
            transform: `scale(${finalScale})`,
            transformOrigin: "top left",
            width: `${PAGE_WIDTH_PX}px`,
            minHeight: `${pageHeightPx}px`,
            position: "absolute",
            left: 0,
            top: 0,
          }}
          className="w-full overflow-hidden"
        >
          {children}
        </div>
        {pageHeightPx > PAGE_HEIGHT_PX && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-amber-400/70 pointer-events-none z-50"
            style={{ top: `${PAGE_HEIGHT_PX * finalScale}px` }}
            title={`Limite page ${page.id === "LETTER" ? "Letter" : "A4"}`}
          />
        )}
      </div>
    </div>
  );
}

interface EditableTextProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
  /** D2 (essai) : éditer ce champ avec TipTap quand le flag est actif. */
  tiptap?: boolean;
}

/** Static (non-editing) rendering of a stored value: sanitized innerHTML for
 *  rich text, textContent for plain strings (XSS-safe by default). */
function renderStaticValue(el: HTMLElement, value: string) {
  const next = value || "";
  if (isRichTextValue(next)) {
    // SECURITY: values may originate from AI output derived from an untrusted
    // job posting. Sanitize before innerHTML injection (strict allowlist) so
    // no executable markup (script, event handlers, <img onerror>…) survives.
    const safe = sanitizeRichHtml(next);
    if (el.innerHTML !== safe) el.innerHTML = safe;
  } else if (el.innerText !== next || el.childElementCount > 0) {
    // Compare via innerText so an unchanged value doesn't clobber the caret.
    el.textContent = next;
  }
}

export function EditableText({
  value,
  onChange,
  className,
  placeholder,
  multiline = false,
  style,
  tiptap = false,
}: EditableTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const format = useCanvasFormat();

  // TipTap (D2) : l'éditeur n'existe que pendant l'édition de CE champ.
  const editorRef = useRef<Editor | null>(null);
  const handleRef = useRef<RichEditorHandle | null>(null);
  // Dernière valeur écrite par ce champ : un retour de `value` identique est
  // l'écho de notre propre commit (on garde l'éditeur) ; toute autre valeur
  // vient de l'extérieur (annuler, formatage de bloc) → on repasse en statique.
  const lastCommittedRef = useRef<string | null>(null);
  const pointerDownRef = useRef(false);
  // Valeur chargée dans l'éditeur et sa forme normalisée par TipTap (ex.
  // `<span style="font-style: italic">` → `<em>`) : contenu inchangé = on garde
  // la chaîne d'origine (ni réécriture ni faux pas d'historique).
  const baselineRef = useRef<{ stored: string; normalized: string } | null>(null);

  // Sync incoming value → DOM (static rendering when not editing).
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const ed = editorRef.current;
    if (ed) {
      if (value === lastCommittedRef.current) return;
      if (ed.isFocused) {
        // Formatage de bloc (ou annuler) pendant l'édition : on recharge la
        // valeur dans l'éditeur, sinon son ancien contenu l'écraserait au blur.
        lastCommittedRef.current = value;
        const { from, to } = ed.state.selection;
        ed.commands.setContent(storedToEditorHtml(value), { emitUpdate: false });
        const max = ed.state.doc.content.size;
        ed.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
        baselineRef.current = { stored: value, normalized: readStoredValue(ed) };
        return;
      }
      // Valeur changée de l'extérieur : l'éditeur (non focalisé) est obsolète.
      editorRef.current = null;
      const h = handleRef.current;
      handleRef.current = null;
      ed.destroy();
      host.contentEditable = "true";
      if (h) format.releaseEditor(h);
    }
    if (isFocused) return;
    renderStaticValue(host, value);
  }, [value, isFocused, format]);

  // Unmount: tear the editor down (pending text was committed on blur).
  useEffect(() => () => {
    const ed = editorRef.current;
    editorRef.current = null;
    ed?.destroy();
  }, []);

  const commit = useCallback((): string => {
    let next: string;
    const ed = editorRef.current;
    if (ed) {
      next = readStoredValue(ed);
      const base = baselineRef.current;
      if (base && next === base.normalized) next = base.stored;
    } else {
      if (!ref.current) return value;
      const html = ref.current.innerHTML;
      // If the rendered content has no inline formatting tags, save the plain
      // text. Keeps the data file readable when the user never used B/I/U.
      // Sanitize rich content on commit too, so anything pasted into the field is
      // cleaned before it reaches storage (defense in depth alongside injection).
      next = isRichTextValue(html) ? trimRich(sanitizeRichHtml(html)) : (ref.current.innerText ?? "").trim();
    }
    if (next !== value) {
      lastCommittedRef.current = next;
      onChange(next);
    }
    return next;
  }, [onChange, value]);

  // Regroupement de frappe : un commit après TYPING_COMMIT_IDLE_MS d'inactivité
  // → chaque rafale devient UN pas de l'historique unifié (Ctrl+Z du canvas).
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearIdle = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  };
  useEffect(() => clearIdle, []);

  const scheduleCommit = () => {
    clearIdle();
    idleTimer.current = setTimeout(() => commitRef.current(), TYPING_COMMIT_IDLE_MS);
  };

  /** Commit (optionnel) puis destruction de l'éditeur ; le champ redevient un
   *  span statique. Appelé quand un autre champ prend la main. */
  const destroyEditor = (withCommit: boolean) => {
    const ed = editorRef.current;
    const host = ref.current;
    if (!ed) return;
    clearIdle();
    const finalValue = withCommit ? commitRef.current() : value;
    editorRef.current = null;
    const h = handleRef.current;
    handleRef.current = null;
    ed.destroy();
    if (host) {
      host.contentEditable = "true";
      renderStaticValue(host, finalValue);
    }
    setIsFocused(false);
    if (h) format.releaseEditor(h);
  };

  /** Monte TipTap dans le span au focus, caret au même caractère. */
  const activateTiptap = () => {
    const host = ref.current;
    if (!host || editorRef.current) return;
    const caret = readTextCaret(host);
    lastCommittedRef.current = value;
    host.contentEditable = "false";
    let handle: RichEditorHandle | null = null;
    const editor = createFieldEditor({
      host,
      value,
      multiline,
      caret,
      onUpdate: () => {
        format.refresh();
        scheduleCommit();
      },
      onSelectionChange: () => format.refresh(),
      onFocus: () => {
        if (!handle) return;
        setIsFocused(true);
        format.registerActiveEditor(handle.dom, handle);
      },
      onBlur: () => {
        clearIdle();
        setIsFocused(false);
        format.registerActiveEditor(null);
        commitRef.current();
      },
    });
    editorRef.current = editor;
    baselineRef.current = { stored: value, normalized: readStoredValue(editor) };
    handle = createEditorHandle(editor, () => destroyEditor(true));
    handleRef.current = handle;
    setIsFocused(true);
    format.registerActiveEditor(handle.dom, handle);
    editor.view.focus();
  };

  const handleBlur = () => {
    if (editorRef.current) return; // TipTap gère son propre blur
    clearIdle();
    setIsFocused(false);
    format.registerActiveEditor(null);
    commit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editorRef.current) return;
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      ref.current?.blur();
    }
  };

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={handleBlur}
      onPointerDown={() => {
        pointerDownRef.current = true;
      }}
      onFocus={(e) => {
        if (editorRef.current || e.target !== ref.current) return;
        if (tiptap && isTiptapEditorEnabled()) {
          // Au clic, le navigateur place le caret APRÈS l'événement focus : on
          // monte l'éditeur au relâchement (caret ou sélection à la souris
          // alors connus). Au clavier (Tab), tout de suite.
          if (pointerDownRef.current) {
            window.addEventListener("pointerup", () => {
              pointerDownRef.current = false;
              activateTiptap();
            }, { once: true, capture: true });
          } else {
            activateTiptap();
          }
          return;
        }
        setIsFocused(true);
        format.registerActiveEditor(ref.current);
      }}
      onInput={() => {
        if (editorRef.current) return;
        // Re-evaluate the toolbar's format state on every typed character so
        // active B/I/U highlights stay in sync as the caret moves.
        format.refresh();
        scheduleCommit();
      }}
      onKeyDown={handleKeyDown}
      data-placeholder={placeholder}
      className={cn(
        "outline-none transition-colors duration-100 cursor-text select-text inline-block min-w-[20px]",
        isFocused
          ? "bg-primary/5 ring-1 ring-primary/20 rounded px-0.5"
          : "hover:bg-primary/5 hover:ring-1 hover:ring-primary/10 rounded px-0.5",
        !value && "text-muted-foreground/40 italic empty:before:content-[attr(data-placeholder)]",
        className
      )}
      style={style}
    />
  );
}
