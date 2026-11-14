"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpCircle, Check, Copy, ExternalLink } from "lucide-react";
import { useDismiss } from "@/hooks/use-dismiss";
import { pickLocale } from "@/lib/release";
import { cn } from "@/lib/utils";
import type { UpdateCheckResponse } from "@/app/api/update-check/route";

/** Résultat gardé pour la session : une seule requête par onglet. */
const SESSION_KEY = "kompyle_update_check";

/** Commandes de mise à jour selon le mode d'installation. */
const COMMANDS = {
  docker: "git pull && docker compose up -d --build",
  node: "git pull && npm ci && npm run build && npm start",
} as const;

/**
 * Avis « mise à jour disponible » de l'en-tête : version installée vs version
 * publiée sur GitHub, notes de version (nouveautés / correctifs) et commande à
 * lancer pour mettre à jour. Rien ne s'affiche si l'app est à jour, hors ligne,
 * ou si la vérification est désactivée (KOMPYLE_UPDATE_CHECK=false).
 */
export function UpdateNotice() {
  const t = useTranslations("Update");
  const locale = useLocale();
  const [info, setInfo] = useState<UpdateCheckResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<keyof typeof COMMANDS>("docker");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = sessionStorage.getItem(SESSION_KEY);
        if (cached) {
          if (!cancelled) setInfo(JSON.parse(cached));
          return;
        }
      } catch {
        // stockage indisponible : on interroge simplement le serveur
      }
      try {
        const res = await fetch("/api/update-check");
        if (!res.ok) return;
        const data = (await res.json()) as UpdateCheckResponse;
        if (cancelled) return;
        setInfo(data);
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
        } catch {
          // sans cache de session : nouvelle vérification au prochain chargement
        }
      } catch {
        // hors ligne : pas d'avis
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info?.updateAvailable) return null;

  const hasFeatures = info.releases.some((r) => r.type === "feature");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDS[mode]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // presse-papiers refusé : la commande reste sélectionnable à la main
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        {t("badge", { version: info.latest })}
      </button>

      {open && (
        <div className="popover-surface motion-pop absolute right-0 top-10 z-50 flex w-[min(92vw,380px)] flex-col gap-3 p-4">
          <div className="flex items-start gap-2.5">
            <ArrowUpCircle size={18} className="mt-0.5 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">{t("title", { version: info.latest })}</span>
              <span className="text-xs text-muted-foreground">
                {t("installed", { version: info.current })} · {hasFeatures ? t("kind_features") : t("kind_fixes")}
              </span>
            </div>
          </div>

          {/* Notes de version : ce qui a changé depuis la version installée */}
          <ul className="scrollbar-thin flex max-h-48 flex-col gap-2 overflow-y-auto">
            {info.releases.map((r) => (
              <li key={r.version} className="rounded-lg border border-border/60 bg-card/60 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-foreground">v{r.version}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-px text-[10px] font-semibold",
                      r.type === "feature" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.type === "feature" ? t("type_feature") : t("type_fix")}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{r.date}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pickLocale(r.summary, locale)}</p>
                {r.type === "feature" && (r.features?.length ?? 0) > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-foreground/90 marker:text-primary">
                    {r.features!.map((f) => (
                      <li key={f.id}>{pickLocale(f.title, locale)}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {/* Comment mettre à jour */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{t("how")}</span>
              <div className="flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5" role="tablist">
                {(Object.keys(COMMANDS) as (keyof typeof COMMANDS)[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-semibold transition-colors",
                      mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(`mode_${m}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 py-1.5 pr-1.5 pl-2.5">
              <code className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap font-mono text-[11px] text-foreground no-scrollbar">
                {COMMANDS[mode]}
              </code>
              <button
                type="button"
                onClick={copy}
                className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label={t("copy")}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{t("data_kept")}</p>
          </div>

          <a
            href={`https://github.com/${info.repository}/blob/main/release.json`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline"
          >
            {t("details")} <ExternalLink size={11} />
          </a>
        </div>
      )}
    </div>
  );
}
