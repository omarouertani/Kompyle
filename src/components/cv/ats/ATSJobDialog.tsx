"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileSearch, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface ATSJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Offre déjà saisie dans le sidebar (peut être vide). */
  existingJobDescription: string;
  /** Lance l'audit avec l'offre choisie. */
  onConfirm: (jobDescription: string) => void;
}

/**
 * Dialogue d'amorçage de l'ATS check.
 * Toujours affiché avant un audit : si une offre existe déjà, propose de la
 * réutiliser ; sinon, ouvre un formulaire de saisie. Le corps interne (avec
 * son state local) n'est monté que pendant que `open === true` — donc l'état
 * se resync naturellement à chaque ouverture, sans useEffect → setState.
 */
export function ATSJobDialog({ open, onOpenChange, existingJobDescription, onConfirm }: ATSJobDialogProps) {
  const trimmed = existingJobDescription.trim();
  const hasExisting = trimmed.length >= 20;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ATSJobDialogBody
          existingJobDescription={trimmed}
          hasExisting={hasExisting}
          onConfirm={(jd) => { onConfirm(jd); onOpenChange(false); }}
          onCancel={() => onOpenChange(false)}
        />
      )}
    </AlertDialog>
  );
}

interface BodyProps {
  existingJobDescription: string;
  hasExisting: boolean;
  onConfirm: (jd: string) => void;
  onCancel: () => void;
}

function ATSJobDialogBody({ existingJobDescription, hasExisting, onConfirm, onCancel }: BodyProps) {
  const t = useTranslations("ATS");
  const [text, setText] = useState(existingJobDescription);
  const [mode, setMode] = useState<"reuse" | "new">(hasExisting ? "reuse" : "new");

  const canSubmit = text.trim().length >= 20;

  const submit = () => {
    if (!canSubmit) return;
    onConfirm(text.trim());
  };

  return (
    <AlertDialogContent className="max-w-lg gap-3">
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 text-base">
          <FileSearch size={16} className="text-primary" />
          {t("dialog_title")}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {hasExisting ? t("dialog_desc_existing") : t("dialog_desc_new")}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {hasExisting && (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("dialog_existing_label")}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="xs"
                  variant={mode === "reuse" ? "default" : "ghost"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => { setMode("reuse"); setText(existingJobDescription); }}
                >
                  {t("dialog_use_existing")}
                </Button>
                <Button
                  size="xs"
                  variant={mode === "new" ? "default" : "ghost"}
                  className="h-6 px-2 text-[11px]"
                  onClick={() => { setMode("new"); setText(""); }}
                >
                  {t("dialog_use_new")}
                </Button>
              </div>
            </div>
            {mode === "reuse" && (
              <p className="text-xs leading-relaxed text-foreground/80 line-clamp-4 whitespace-pre-line">
                {existingJobDescription}
              </p>
            )}
          </div>
          <Separator className="my-1" />
        </>
      )}

      {(mode === "new" || !hasExisting) && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("dialog_input_label")}
          </label>
          <Textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("dialog_input_placeholder")}
            className="min-h-[140px] resize-y text-sm leading-relaxed"
          />
          <span className="text-[10px] text-muted-foreground">
            {t("dialog_input_hint")}
          </span>
        </div>
      )}

      <AlertDialogFooter>
        <Button variant="outline" className="h-8 px-3 text-xs" onClick={onCancel}>
          {t("dialog_cancel")}
        </Button>
        <Button
          className="h-8 px-3 text-xs gap-1.5"
          onClick={submit}
          disabled={!canSubmit}
        >
          <Sparkles size={13} />
          {t("dialog_confirm")}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
