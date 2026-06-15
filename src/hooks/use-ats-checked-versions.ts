"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "kompyle.ats.checkedVersions";

// ── Store partagé (singleton) au-dessus de localStorage ──────────────────────
// Évite le pattern useEffect→setState (déclenche un re-render en chaîne) en
// passant par `useSyncExternalStore`, l'API officielle React pour les sources
// externes synchrones.

let snapshot: ReadonlySet<string> = new Set();
let initialized = false;
const listeners = new Set<() => void>();

function readStorage(): ReadonlySet<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  snapshot = readStorage();
}

function setSnapshot(next: ReadonlySet<string>) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // quota plein / mode privé : on accepte la perte au prochain reload
  }
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  ensureInit();
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): ReadonlySet<string> {
  ensureInit();
  return snapshot;
}

const EMPTY: ReadonlySet<string> = new Set();
function getServerSnapshot(): ReadonlySet<string> {
  return EMPTY;
}

/**
 * Suit l'ensemble des identifiants de version de CV qui ont DÉJÀ été audités
 * par l'ATS Checker. Sert à mettre en avant le bouton ATS (effet « diamant »)
 * tant que l'utilisateur ne l'a jamais lancé pour la version sélectionnée,
 * puis le calmer une fois la fonctionnalité découverte.
 *
 * Persisté en localStorage : volontairement côté client (pas en BD), car
 * c'est un marqueur d'UI, pas une donnée métier.
 */
export function useATSCheckedVersions() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const markChecked = useCallback((versionId: string | null | undefined) => {
    if (!versionId || ids.has(versionId)) return;
    const next = new Set(ids);
    next.add(versionId);
    setSnapshot(next);
  }, [ids]);

  const isChecked = useCallback((versionId: string | null | undefined): boolean => {
    if (!versionId) return false;
    return ids.has(versionId);
  }, [ids]);

  return { isChecked, markChecked };
}
