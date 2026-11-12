"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  FileText,
  FileUp,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/motion";
import { ApiKeysDialog } from "@/components/ApiKeysDialog";
import { cn } from "@/lib/utils";
import type { AIProvider } from "@/types/cv";
import { getModelName } from "@/lib/ai-models";
import { PROVIDER_META } from "@/hooks/use-ai-provider-config";
import { useCVImport, type ImportErrorState } from "@/hooks/use-cv-import";
import { IMPORT_ACCEPT } from "@/lib/cv-import/limits";
import type { ImportedCV } from "@/lib/cv-import/schema";
import { ImportReview } from "./ImportReview";

export type ImportTarget = { mode: "replace" } | { mode: "new"; profileName: string };

interface CVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fichier déposé sur l'éditeur : lu dès l'ouverture (localement). */
  initialFile?: File | null;
  provider: AIProvider;
  model: string;
  apiKey: string | undefined;
  /** Création d'un nouveau profil possible (base de données disponible). */
  canCreateProfile: boolean;
  /** Applique le CV importé ; renvoie false si l'application a échoué (dialog laissé ouvert). */
  onApply: (cv: ImportedCV, target: ImportTarget) => Promise<boolean> | boolean;
}

/**
 * Import d'un CV existant en trois temps : choisir (fichier ou texte collé, lu
 * dans le navigateur) → analyse par le provider IA choisi (après avertissement
 * explicite) → vérification des champs extraits avant de remplacer le CV.
 */
export function CVImportDialog({ open, onOpenChange, initialFile, provider, model, apiKey, canCreateProfile, onApply }: CVImportDialogProps) {
  const t = useTranslations("CVImport");
  const tErr = useTranslations("AIErrors");
  const imp = useCVImport({ provider, model, apiKey });
  const { readFile, reset } = imp;
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [applying, setApplying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fichier déposé sur l'éditeur : lu (localement) dès l'ouverture.
  useEffect(() => {
    if (open && initialFile) void readFile(initialFile);
  }, [open, initialFile, readFile]);

  const providerLabel = PROVIDER_META[provider]?.label ?? provider;
  const modelLabel = getModelName(model);
  const busy = imp.phase === "reading" || imp.phase === "analyzing" || applying;

  // Fermeture : requête abandonnée et texte du CV oublié.
  const close = () => {
    reset();
    setPasteOpen(false);
    setPasted("");
    onOpenChange(false);
  };

  const errorMessage = (e: ImportErrorState): string => {
    if (e.code === "missing_key") return tErr("missing_key");
    if (e.failure) {
      if (e.failure.reason === "rate_limit" && e.failure.retryAfterSeconds !== undefined) {
        return tErr("rate_limit_retry", { seconds: e.failure.retryAfterSeconds });
      }
      return tErr(e.failure.reason);
    }
    return t.has(`error_${e.code}`) ? t(`error_${e.code}`) : t("error_ai_failed");
  };

  const apply = async (cv: ImportedCV, target: ImportTarget) => {
    setApplying(true);
    try {
      const ok = await onApply(cv, target);
      if (ok) close();
    } finally {
      setApplying(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void imp.readFile(file);
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <AlertDialogContent
        className="sm:max-w-xl max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => { if (applying) e.preventDefault(); }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <FileUp size={17} className="text-primary" />
            {t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription>{imp.phase === "review" ? t("review_subtitle") : t("subtitle")}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* ── 1. Choisir un fichier ou coller le texte ─────────────────────── */}
        {(imp.phase === "choose" || imp.phase === "reading") && (
          <div className="flex flex-col gap-3">
            <label
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40",
                imp.phase === "reading" && "pointer-events-none opacity-70",
              )}
            >
              {imp.phase === "reading" ? (
                <>
                  <Spinner size={22} className="text-primary" />
                  <span className="text-sm font-medium">{t("reading")}</span>
                </>
              ) : (
                <>
                  <FileUp size={26} className="text-primary" />
                  <span className="text-sm font-medium text-foreground">{t("drop_title")}</span>
                  <span className="text-xs text-muted-foreground">{t("drop_formats")}</span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept={IMPORT_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void imp.readFile(file);
                  e.target.value = "";
                }}
              />
            </label>

            {!pasteOpen ? (
              <Button variant="ghost" size="sm" className="self-center text-muted-foreground" onClick={() => setPasteOpen(true)} disabled={busy}>
                <ClipboardPaste size={14} />
                {t("paste_toggle")}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={t("paste_placeholder")}
                  className="min-h-36 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <Button size="sm" className="self-end" disabled={!pasted.trim()} onClick={() => imp.submitPastedText(pasted)}>
                  {t("paste_use")}
                </Button>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">{t("scanned_hint")}</p>
            {imp.error && <ErrorBox message={errorMessage(imp.error)} />}
          </div>
        )}

        {/* ── 2. Texte prêt : confidentialité, puis envoi au provider ────────── */}
        {(imp.phase === "ready" || imp.phase === "analyzing") && imp.source && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <FileText size={18} className="shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{imp.source.fileName ?? t("pasted_text")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("chars_read", { count: imp.source.text.length })}
                  {imp.source.truncated && ` · ${t("truncated")}`}
                </p>
              </div>
              {imp.phase === "ready" && (
                <Button variant="ghost" size="xs" onClick={() => { imp.reset(); setPasted(""); }}>
                  {t("change_file")}
                </Button>
              )}
            </div>

            {imp.phase === "ready" ? (
              <>
                <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-foreground">
                  <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" />
                  <p>{t("privacy_notice", { provider: providerLabel, model: modelLabel })}</p>
                </div>
                {!apiKey?.trim() && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <span className="flex-1">{tErr("missing_key")}</span>
                    <ApiKeysDialog />
                  </div>
                )}
                {imp.error && <ErrorBox message={errorMessage(imp.error)} />}
              </>
            ) : (
              <ol className="flex flex-col gap-2 rounded-lg border border-border px-3 py-3 text-sm" aria-live="polite">
                <Step done label={t("step_read")} />
                <Step active label={t("step_analyze", { provider: providerLabel })} />
                <Step label={t("step_review")} />
                <p className="pl-6 text-xs text-muted-foreground">{t("analyze_hint")}</p>
              </ol>
            )}
          </div>
        )}

        {/* ── 3. Vérification avant d'appliquer ───────────────────────────────── */}
        {imp.phase === "review" && imp.result && (
          <ImportReview
            result={imp.result}
            canCreateProfile={canCreateProfile}
            applying={applying}
            onRestart={() => { imp.reset(); setPasted(""); }}
            onApply={apply}
          />
        )}

        {imp.phase !== "review" && (
          <AlertDialogFooter>
            {imp.phase === "analyzing" ? (
              <Button variant="outline" onClick={imp.cancelAnalysis}>
                <X size={14} />
                {t("cancel_analysis")}
              </Button>
            ) : (
              <Button variant="outline" onClick={close}>{t("cancel")}</Button>
            )}
            {(imp.phase === "ready" || imp.phase === "analyzing") && (
              <Button onClick={() => void imp.analyze()} disabled={imp.phase === "analyzing" || !apiKey?.trim()}>
                {imp.phase === "analyzing" ? <Spinner size={14} /> : <Sparkles size={14} />}
                {t("analyze", { provider: providerLabel })}
              </Button>
            )}
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <p className="leading-relaxed">{message}</p>
    </div>
  );
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <li className={cn("flex items-center gap-2", !done && !active && "text-muted-foreground")}>
      <span className="flex size-4 items-center justify-center">
        {done ? <Check size={14} className="text-emerald-500" /> : active ? <Spinner size={13} className="text-primary" /> : <span className="size-1.5 rounded-full bg-border" />}
      </span>
      {label}
    </li>
  );
}
