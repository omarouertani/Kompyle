"use client";

import { useCallback, useRef, useState } from "react";
import type { AIProvider } from "@/types/cv";
import type { ProviderFailure } from "@/lib/ai-orchestrator";
import { ExtractError, extractCvText, finalizeText, type ImportFileKind } from "@/lib/cv-import/extract-text";
import type { ImportCVResponse } from "@/lib/cv-import/schema";

/**
 * États de l'import :
 *  choose    → l'utilisateur choisit un fichier ou colle son texte ;
 *  reading   → lecture du fichier DANS le navigateur ;
 *  ready     → texte prêt, rien n'est encore parti (avertissement de confidentialité) ;
 *  analyzing → texte envoyé au provider IA choisi ;
 *  review    → écran de vérification avant d'appliquer.
 */
export type ImportPhase = "choose" | "reading" | "ready" | "analyzing" | "review";

export interface ImportSource {
  /** Nom du fichier, ou null pour un texte collé. */
  fileName: string | null;
  kind: ImportFileKind;
  text: string;
  truncated: boolean;
}

export interface ImportErrorState {
  /** Code traduit dans le namespace CVImport (`error_<code>`), ou raison d'échec provider (AIErrors). */
  code: string;
  failure?: ProviderFailure;
}

interface UseCVImportDeps {
  provider: AIProvider;
  model: string;
  apiKey: string | undefined;
}

export function useCVImport({ provider, model, apiKey }: UseCVImportDeps) {
  const [phase, setPhase] = useState<ImportPhase>("choose");
  const [source, setSource] = useState<ImportSource | null>(null);
  const [result, setResult] = useState<ImportCVResponse | null>(null);
  const [error, setError] = useState<ImportErrorState | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Jeton de lecture : une lecture lente annulée (nouveau fichier, fermeture) ne
  // doit pas écraser l'état plus récent.
  const readToken = useRef(0);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    readToken.current++;
    setPhase("choose");
    setSource(null);
    setResult(null);
    setError(null);
  }, []);

  const readFile = useCallback(async (file: File) => {
    abortRef.current?.abort();
    const token = ++readToken.current;
    setError(null);
    setResult(null);
    setPhase("reading");
    try {
      const extracted = await extractCvText(file);
      if (token !== readToken.current) return;
      setSource({ fileName: file.name, ...extracted });
      setPhase("ready");
    } catch (e) {
      if (token !== readToken.current) return;
      setSource(null);
      setError({ code: e instanceof ExtractError ? e.code : "read_failed" });
      setPhase("choose");
    }
  }, []);

  /** Texte collé : mêmes contrôles qu'un fichier (longueur, troncature). */
  const submitPastedText = useCallback((text: string): boolean => {
    readToken.current++;
    setResult(null);
    try {
      setSource({ fileName: null, ...finalizeText(text, "paste") });
      setError(null);
      setPhase("ready");
      return true;
    } catch (e) {
      setError({ code: e instanceof ExtractError ? e.code : "read_failed" });
      return false;
    }
  }, []);

  const analyze = useCallback(async () => {
    if (!source) return;
    if (!apiKey?.trim()) {
      setError({ code: "missing_key" });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setPhase("analyzing");
    try {
      const res = await fetch("/api/import-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source.text, provider, model, apiKey }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (!res.ok) {
        const failure: ProviderFailure | undefined = data?.failures?.[0];
        setError({ code: typeof data?.code === "string" ? data.code : "ai_failed", failure });
        setPhase("ready");
        return;
      }
      setResult(data as ImportCVResponse);
      setPhase("review");
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError({ code: "network" });
      setPhase("ready");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [source, provider, model, apiKey]);

  /** Annule l'analyse en cours (la requête est abandonnée, rien n'est appliqué). */
  const cancelAnalysis = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase(source ? "ready" : "choose");
  }, [source]);

  return { phase, source, result, error, readFile, submitPastedText, analyze, cancelAnalysis, reset };
}
