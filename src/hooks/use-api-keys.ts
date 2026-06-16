"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { AIProvider } from "@/types/cv";
import { subscribe, getSnapshot, getServerSnapshot, writeKey, type ApiKeys } from "@/lib/api-keys";

/**
 * Accès réactif aux clés API saisies par l'utilisateur (BYOK, localStorage).
 * SSR-safe via `useSyncExternalStore`.
 */
export function useApiKeys() {
  const keys = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setKey = useCallback((provider: AIProvider, key: string) => {
    writeKey(provider, key);
  }, []);

  const hasKey = useCallback((provider: AIProvider): boolean => {
    return !!keys[provider];
  }, [keys]);

  return { keys: keys as ApiKeys, setKey, hasKey };
}
