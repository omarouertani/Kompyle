"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { KeyRound, Check, ExternalLink, Eye, EyeOff, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApiKeys } from "@/hooks/use-api-keys";
import { readRetiredProviders, forgetRetiredKeys } from "@/lib/api-keys";
import { PROVIDER_META } from "@/hooks/use-ai-provider-config";
import { PROVIDERS, PROVIDER_KEY_URLS } from "@/lib/ai-models";
import type { AIProvider } from "@/types/cv";


function KeyRow({ provider }: { provider: AIProvider }) {
  const t = useTranslations("ApiKeys");
  const { keys, setKey } = useApiKeys();
  const [reveal, setReveal] = useState(false);
  const meta = PROVIDER_META[provider];
  const value = keys[provider] ?? "";
  const saved = !!value;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
          {meta.label}
          {meta.free && (
            <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-semibold text-primary">
              {t("free_badge")}
            </span>
          )}
        </span>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
            <Check size={12} /> {t("saved")}
          </span>
        ) : (
          <a
            href={PROVIDER_KEY_URLS[provider]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {t("get_key")} <ExternalLink size={11} />
          </a>
        )}
      </div>
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => setKey(provider, e.target.value)}
          placeholder={t("placeholder")}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "w-full h-10 rounded-lg border border-border bg-muted/40 pl-3 pr-9 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-colors",
            "font-mono",
          )}
        />
        {value && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={reveal ? "Hide" : "Show"}
          >
            {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Avertit qu'une clé enregistrée appartient à un provider retiré (ex. Mistral) :
 * elle est ignorée, l'utilisateur est invité à choisir un autre provider et
 * peut la supprimer. Rendu seulement dialog ouvert (client) → lecture directe
 * du stockage sans risque d'écart d'hydratation.
 */
function RetiredKeysNotice() {
  const t = useTranslations("ApiKeys");
  const [retired, setRetired] = useState<string[]>(() => readRetiredProviders());
  if (retired.length === 0) return null;
  const names = retired.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
      <Info size={14} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-relaxed">{t("retired_notice", { providers: names })}</p>
      <button
        type="button"
        onClick={() => { forgetRetiredKeys(); setRetired([]); }}
        className="shrink-0 font-semibold underline-offset-2 hover:underline"
      >
        {t("retired_forget")}
      </button>
    </div>
  );
}

/**
 * Gestion des clés API (BYOK). Bouton-déclencheur + dialog. Les clés sont stockées
 * en localStorage (jamais commitées, envoyées uniquement vers le provider choisi).
 */
export function ApiKeysDialog({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const t = useTranslations("ApiKeys");
  const { keys } = useApiKeys();
  const configuredCount = PROVIDERS.filter((p) => keys[p]).length;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {iconOnly ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("relative text-muted-foreground hover:text-foreground", className)}
            title={t("manage_button")}
            aria-label={t("manage_button")}
          >
            <KeyRound size={15} />
            {configuredCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
            )}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 text-xs", className)}>
            <KeyRound size={14} />
            {t("manage_button")}
            {configuredCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                {configuredCount}
              </span>
            )}
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <KeyRound size={16} className="text-primary" />
            {t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("subtitle")}</AlertDialogDescription>
        </AlertDialogHeader>

        <RetiredKeysNotice />

        <div className="flex flex-col gap-4 py-1">
          {PROVIDERS.map((p) => (
            <KeyRow key={p} provider={p} />
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("security_note")}</p>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("done")}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
