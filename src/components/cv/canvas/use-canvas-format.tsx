"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { DEFAULT_FORMAT_STATE as DEFAULT_STATE, type FormatCommand, type FormatState, type RichEditorHandle } from "./format-types";

export type { FormatState, FormatCommand, RichEditorHandle };

interface FormatApi {
  state: FormatState;
  /** Called by EditableText when its TipTap editor takes focus (with its command
   *  handle), and with `null` on blur. Registering a NEW editor deactivates the
   *  previous one (one live editor at most). */
  registerActiveEditor: (el: HTMLElement | null, handle?: RichEditorHandle | null) => void;
  /** Called when a TipTap field editor is torn down. */
  releaseEditor: (handle: RichEditorHandle) => void;
  /** Apply a format command. Returns true if applied to an active editor. */
  exec: (command: FormatCommand, value?: string) => boolean;
  /** Apply a CSS property to the selected text only. If the selection is
   *  collapsed, applies to the whole field so clicking a size with the caret
   *  somewhere still does something useful. */
  applyInlineStyle: (prop: string, value: string) => boolean;
  /** Like `applyInlineStyle` but sets several CSS properties at once (e.g. a
   *  heading: font-size + font-weight + color). */
  applyInlineStyles: (styles: Record<string, string>) => boolean;
  /** Force-refresh the toolbar's format state (call after exec). */
  refresh: () => void;
  activeEditor: HTMLElement | null;
}

const FormatContext = createContext<FormatApi | null>(null);

export function CanvasFormatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FormatState>(DEFAULT_STATE);
  // Command handle of the "anchored" editor: the last focused field. It stays
  // set while focus moves to a toolbar button, so commands still reach it.
  const handleRef = useRef<RichEditorHandle | null>(null);
  const [activeEditor, setActiveEditor] = useState<HTMLElement | null>(null);

  const computeState = useCallback((): FormatState => {
    const h = handleRef.current;
    if (!h) return DEFAULT_STATE;
    try { return h.readState(); } catch { return { ...DEFAULT_STATE, hasActiveEditor: true }; }
  }, []);

  const refresh = useCallback(() => {
    setState(computeState());
  }, [computeState]);

  const registerActiveEditor = useCallback((el: HTMLElement | null, handle?: RichEditorHandle | null) => {
    if (el) {
      const prev = handleRef.current;
      handleRef.current = handle ?? null;
      if (prev && prev !== handle) prev.deactivate();
    }
    setActiveEditor(el);
    setState(computeState());
  }, [computeState]);

  const releaseEditor = useCallback((handle: RichEditorHandle) => {
    if (handleRef.current !== handle) return;
    handleRef.current = null;
    setActiveEditor((cur) => (cur === handle.dom ? null : cur));
    setState(computeState());
  }, [computeState]);

  const exec = useCallback<FormatApi["exec"]>((command, value) => {
    const h = handleRef.current;
    if (!h) return false;
    const ok = h.exec(command, value);
    setState(computeState());
    return ok;
  }, [computeState]);

  const applyInlineStyles = useCallback((styles: Record<string, string>): boolean => {
    const h = handleRef.current;
    if (!h) return false;
    const ok = h.applyStyles(styles);
    setState(computeState());
    return ok;
  }, [computeState]);

  const applyInlineStyle = useCallback((prop: string, val: string): boolean =>
    applyInlineStyles({ [prop]: val }),
  [applyInlineStyles]);

  const value = useMemo<FormatApi>(() => ({ state, registerActiveEditor, releaseEditor, exec, applyInlineStyle, applyInlineStyles, refresh, activeEditor }), [state, registerActiveEditor, releaseEditor, exec, applyInlineStyle, applyInlineStyles, refresh, activeEditor]);

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
    releaseEditor: () => {},
    exec: () => false,
    applyInlineStyle: () => false,
    applyInlineStyles: () => false,
    refresh: () => {},
    activeEditor: null,
  };
}
