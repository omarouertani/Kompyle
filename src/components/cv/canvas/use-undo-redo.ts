"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CVData } from "@/types/cv";
import { HISTORY_LIMIT, HISTORY_COALESCE_MS } from "./constants";

/** Undo / Redo basé sur une pile de snapshots CVData.
 *
 *  Un snapshot est poussé avant chaque mutation via `onChange`. Les mutations
 *  rapprochées (<400 ms : drag de slider, auto-reflow consécutif à une édition)
 *  sont coalescées en un seul pas d'annulation.
 *
 *  Retourne `onChange` (à brancher partout à la place du onChange parent),
 *  ainsi que `undo` / `redo`. */
export function useUndoRedo(data: CVData, onChangeProp: (newData: CVData) => void) {
  const presentRef = useRef(data);
  useEffect(() => {
    presentRef.current = data;
  }, [data]);
  const undoStack = useRef<CVData[]>([]);
  const redoStack = useRef<CVData[]>([]);
  const lastPushTs = useRef(0);

  const onChange = useCallback(
    (next: CVData) => {
      const now = Date.now();
      if (now - lastPushTs.current > HISTORY_COALESCE_MS) {
        undoStack.current.push(presentRef.current);
        if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
        redoStack.current = [];
      }
      lastPushTs.current = now;
      onChangeProp(next);
    },
    [onChangeProp]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(presentRef.current);
    lastPushTs.current = 0; // la prochaine mutation repart sur un nouveau pas
    onChangeProp(prev);
  }, [onChangeProp]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(presentRef.current);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    lastPushTs.current = 0;
    onChangeProp(next);
  }, [onChangeProp]);

  return { onChange, undo, redo };
}
