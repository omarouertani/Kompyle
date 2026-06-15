"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/** Snapshot of the current text selection's format state. Drives toolbar UI
 *  (active B/I/U highlights). Recomputed via `selectionchange` whenever the
 *  user's cursor or selection moves inside any registered EditableText. */
export interface FormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  align: "left" | "center" | "right" | "justify" | null;
  textColor: string | null;
  hasSelection: boolean;
  hasActiveEditor: boolean;
}

const DEFAULT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  align: null,
  textColor: null,
  hasSelection: false,
  hasActiveEditor: false,
};

interface FormatApi {
  state: FormatState;
  /** Called by EditableText on focus to register itself as the active editor. */
  registerActiveEditor: (el: HTMLElement | null) => void;
  /** Apply a format command. Returns true if applied to an active editor. */
  exec: (command: "bold" | "italic" | "underline" | "strikeThrough" | "foreColor" | "justifyLeft" | "justifyCenter" | "justifyRight" | "justifyFull" | "removeFormat", value?: string) => boolean;
  /** Wrap the current selection in a `<span style="prop: value">` so font /
   *  size / family changes apply ONLY to the selected substring, not to the
   *  whole block. If the selection is collapsed, expands to the entire editor
   *  so clicking a size with the caret somewhere still does something useful. */
  applyInlineStyle: (prop: string, value: string) => boolean;
  /** Force-refresh the toolbar's format state (call after exec). */
  refresh: () => void;
  activeEditor: HTMLElement | null;
}

const FormatContext = createContext<FormatApi | null>(null);

export function CanvasFormatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FormatState>(DEFAULT_STATE);
  const activeEditorRef = useRef<HTMLElement | null>(null);
  // The "live" editor is whatever currently has focus. When the user clicks a
  // toolbar button, focus moves out — we keep the LAST editor that was focused
  // (the "anchored" editor) so we can route exec() back to it.
  const anchoredEditorRef = useRef<HTMLElement | null>(null);
  // Last selection range inside an anchored editor. Saved on every selectionchange
  // and on editor blur so we can restore it before execCommand (a Range that's no
  // longer in the live Selection is still valid as long as its nodes remain mounted).
  const savedRangeRef = useRef<Range | null>(null);
  const [activeEditor, setActiveEditor] = useState<HTMLElement | null>(null);

  const computeState = useCallback((): FormatState => {
    // Use the anchored editor (last focused) so the toolbar keeps reflecting the
    // selection state even after focus moves out to a toolbar button.
    const el = activeEditorRef.current ?? anchoredEditorRef.current;
    if (!el || !el.isContentEditable) return DEFAULT_STATE;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) {
      return { ...DEFAULT_STATE, hasActiveEditor: !!el };
    }
    // Selection must be inside the anchored editor.
    const anchor = sel.anchorNode;
    if (!anchor || !el.contains(anchor)) {
      return { ...DEFAULT_STATE, hasActiveEditor: !!el };
    }
    try {
      const safeQueryState = (cmd: string): boolean => {
        try { return document.queryCommandState(cmd); } catch { return false; }
      };
      const safeQueryValue = (cmd: string): string => {
        try { return document.queryCommandValue(cmd); } catch { return ""; }
      };
      const align: FormatState["align"] = safeQueryState("justifyCenter")
        ? "center"
        : safeQueryState("justifyRight")
          ? "right"
          : safeQueryState("justifyFull")
            ? "justify"
            : "left";
      return {
        bold: safeQueryState("bold"),
        italic: safeQueryState("italic"),
        underline: safeQueryState("underline"),
        strike: safeQueryState("strikeThrough"),
        align,
        textColor: safeQueryValue("foreColor") || null,
        hasSelection: !sel.isCollapsed,
        hasActiveEditor: true,
      };
    } catch {
      return { ...DEFAULT_STATE, hasActiveEditor: true };
    }
  }, []);

  const refresh = useCallback(() => {
    setState(computeState());
  }, [computeState]);

  const registerActiveEditor = useCallback((el: HTMLElement | null) => {
    activeEditorRef.current = el;
    if (el) {
      anchoredEditorRef.current = el;
    }
    setActiveEditor(el);
    setState(computeState());
  }, [computeState]);

  // Make execCommand emit CSS spans (`<span style="color: …">`) instead of
  // legacy `<font>` tags. Browsers default this to false. Setting it once at
  // mount is enough for the lifetime of this provider.
  useEffect(() => {
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* ignored */ }
  }, []);

  // Re-evaluate format state whenever the selection changes anywhere in the doc.
  // We also snapshot the live range so a later toolbar click can restore it
  // even after focus moved to the button.
  useEffect(() => {
    const onSelectionChange = () => {
      const sel = window.getSelection();
      const anchored = anchoredEditorRef.current;
      if (sel && sel.rangeCount > 0 && anchored && anchored.contains(sel.anchorNode)) {
        savedRangeRef.current = sel.getRangeAt(0).cloneRange();
      }
      setState(computeState());
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [computeState]);

  const exec = useCallback<FormatApi["exec"]>((command, value) => {
    const el = activeEditorRef.current ?? anchoredEditorRef.current;
    if (!el || !el.isContentEditable) return false;
    // Re-focus the anchored editor and restore its saved selection. We must do
    // this BEFORE execCommand — otherwise the command runs on whatever (if
    // anything) is focused in the page, which for a toolbar click is usually
    // the button itself, and the call silently no-ops.
    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
    const sel = window.getSelection();
    if (sel) {
      const saved = savedRangeRef.current;
      const needsRestore =
        sel.rangeCount === 0 || !el.contains(sel.anchorNode);
      if (needsRestore) {
        const range = saved && el.contains(saved.startContainer)
          ? saved
          : (() => {
              const r = document.createRange();
              r.selectNodeContents(el);
              r.collapse(false);
              return r;
            })();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
    let ok = false;
    try {
      // execCommand is the only mainstream way to mutate contentEditable selections
      // without rewriting our entire EditableText into a rich-text framework. The
      // replacement (Selection + Range APIs) doesn't toggle inline styles for us.
      ok = document.execCommand(command, false, value);
    } catch {
      return false;
    }
    // Notify the editor that its content changed so React state syncs (we dispatch
    // an `input` event because contentEditable's React onInput only fires for typing).
    el.dispatchEvent(new Event("input", { bubbles: true }));
    // Re-snapshot the new selection so consecutive commands chain correctly.
    const sel2 = window.getSelection();
    if (sel2 && sel2.rangeCount > 0 && el.contains(sel2.anchorNode)) {
      savedRangeRef.current = sel2.getRangeAt(0).cloneRange();
    }
    setState(computeState());
    return ok;
  }, [computeState]);

  const applyInlineStyle = useCallback((prop: string, val: string): boolean => {
    const el = activeEditorRef.current ?? anchoredEditorRef.current;
    if (!el || !el.isContentEditable) return false;

    if (document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
    const sel = window.getSelection();
    if (!sel) return false;

    // Restore the saved range if focus had moved out (toolbar click).
    if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      const saved = savedRangeRef.current;
      const range = saved && el.contains(saved.startContainer)
        ? saved.cloneRange()
        : (() => {
            const r = document.createRange();
            r.selectNodeContents(el);
            return r;
          })();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    let range = sel.getRangeAt(0);
    // Collapsed selection → expand to the entire editor so clicking a size
    // with the caret somewhere doesn't silently do nothing.
    if (range.collapsed) {
      range = document.createRange();
      range.selectNodeContents(el);
    }

    try {
      const fragment = range.extractContents();
      const span = document.createElement("span");
      span.style.setProperty(prop, val);
      span.appendChild(fragment);
      range.insertNode(span);

      // Re-select the wrapped content so consecutive style changes chain.
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(newRange);
      savedRangeRef.current = newRange.cloneRange();
    } catch {
      return false;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    setState(computeState());
    return true;
  }, [computeState]);

  const value = useMemo<FormatApi>(() => ({ state, registerActiveEditor, exec, applyInlineStyle, refresh, activeEditor }), [state, registerActiveEditor, exec, applyInlineStyle, refresh, activeEditor]);

  return <FormatContext.Provider value={value}>{children}</FormatContext.Provider>;
}

/** Hook for toolbar UI: read format state, apply format commands. Returns a
 *  no-op API when used outside a `CanvasFormatProvider` so consumers can render
 *  without a provider (e.g. side-by-side preview without toolbar). */
export function useCanvasFormat(): FormatApi {
  const ctx = useContext(FormatContext);
  if (ctx) return ctx;
  return {
    state: DEFAULT_STATE,
    registerActiveEditor: () => {},
    exec: () => false,
    applyInlineStyle: () => false,
    refresh: () => {},
    activeEditor: null,
  };
}
