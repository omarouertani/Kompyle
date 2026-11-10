"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CVData } from "@/types/cv";
import { HISTORY_LIMIT, HISTORY_COALESCE_MS } from "./constants";

/** Undo / Redo basé sur une pile de snapshots CVData.
 *
 *  Un snapshot est poussé avant chaque mutation via `onChange`. Deux règles de
 *  coalescence, pour qu'un « Ctrl+Z » corresponde à UNE action perçue :
 *   - Les mutations rapprochées de MÊME nature (même `coalesceKey`, ou toutes
 *     deux sans clé comme une frappe au clavier) fusionnent en un seul pas.
 *   - Un CHANGEMENT de nature d'action (clé différente : drag → thème, thème →
 *     frappe…) force TOUJOURS un nouveau pas, même à quelques ms d'intervalle.
 *  Avant : une fenêtre glissante de 400 ms sans notion de nature fusionnait une
 *  action sans rapport faite juste après un drag (impossible d'annuler l'une
 *  sans l'autre). Les appelants passent une clé ("drag", "resize", "theme",
 *  "move"…) ; les éditions de texte n'en passent pas (coalescence temporelle).
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
  const lastKeyRef = useRef<string | undefined>(undefined);

  const onChange = useCallback(
    (next: CVData, coalesceKey?: string) => {
      const now = Date.now();
      const keyChanged = coalesceKey !== lastKeyRef.current;
      const tooOld = now - lastPushTs.current > HISTORY_COALESCE_MS;
      if (tooOld || keyChanged) {
        undoStack.current.push(presentRef.current);
        if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
        redoStack.current = [];
      }
      // Fenêtre glissante pour une rafale de MÊME nature (drag de slider, frappe).
      lastPushTs.current = now;
      lastKeyRef.current = coalesceKey;
      onChangeProp(next);
    },
    [onChangeProp]
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(presentRef.current);
    lastPushTs.current = 0; // la prochaine mutation repart sur un nouveau pas
    lastKeyRef.current = undefined;
    onChangeProp(prev);
  }, [onChangeProp]);

  const redo = useCallback(() => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(presentRef.current);
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift();
    lastPushTs.current = 0;
    lastKeyRef.current = undefined;
    onChangeProp(next);
  }, [onChangeProp]);

  return { onChange, undo, redo };
}
