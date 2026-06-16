"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, RotateCcw, ShieldCheck } from "lucide-react";
import type { AIProvider, CVData } from "@/types/cv";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useATSCheck } from "@/hooks/use-ats-check";
import AIProgressOverlay from "@/components/cv/AIProgressOverlay";
import { ATSEmptyState } from "./ATSEmptyState";
import { ATSSkeleton } from "./ATSSkeleton";
import { ATSResultsView } from "./ATSResultsView";
import { ATSJobDialog } from "./ATSJobDialog";
import { ATSAdaptPanel } from "./ATSAdaptPanel";
import { ATSAIError } from "./ATSAIError";

interface ATSCheckerProps {
  cvData: CVData;
  /** Nom long du CV courant : « Prénom Nom — Rôle · nom-de-version ». */
  cvDisplayName: string;
  /** ID de la version DB du CV courant — sert au marquage « déjà audité ». */
  cvVersionId: string | null;
  jobDescription: string;
  provider: AIProvider;
  model: string;
  /** Clé API du provider sélectionné (BYOK). */
  apiKey: string | undefined;
  /** Compteur incrémenté par le parent quand l'utilisateur ouvre l'ATS Checker. */
  triggerKey: number;
  /** Notifie le parent qu'un audit s'est terminé avec succès (pour le marquage). */
  onChecked: (versionId: string | null) => void;
  /** Le panneau « Adapter ce CV » applique le CV raffiné via cette callback. */
  onApplyRefinedCV: (cv: CVData) => void;
}

/**
 * Panneau central ATS Checker — orchestre dialogue → loading skeleton → résultats.
 * Le CV analysé est celui actuellement sélectionné côté CVPreview (via la version
 * du sélecteur d'historique). L'offre d'emploi vient soit du sidebar, soit d'une
 * saisie dans le dialog. L'audit s'exécute via /api/ats-check avec fallback
 * automatique de providers IA (zéro choix exposé à l'utilisateur).
 */
export function ATSChecker({
  cvData,
  cvDisplayName,
  cvVersionId,
  jobDescription,
  provider,
  model,
  apiKey,
  triggerKey,
  onChecked,
  onApplyRefinedCV,
}: ATSCheckerProps) {
  const t = useTranslations("ATS");
  const tAdapt = useTranslations("AIAdapt");
  const [adapting, setAdapting] = useState(false);
  const {
    status,
    report,
    errorMessage,
    errorDetails,
    errorFailures,
    lastJobDescription,
    run,
    reset,
  } = useATSCheck();

  const [dialogOpen, setDialogOpen] = useState(false);
  const lastTriggerRef = useRef(triggerKey);
  const notifiedReportRef = useRef<typeof report>(null);

  // Ouvre le dialog quand le parent incrémente la clé (bouton ATS de la toolbar).
  useEffect(() => {
    if (triggerKey !== lastTriggerRef.current) {
      lastTriggerRef.current = triggerKey;
      setDialogOpen(true);
    }
  }, [triggerKey]);

  // Notifie le parent UNE seule fois par audit réussi (pas à chaque re-render).
  useEffect(() => {
    if (status === "success" && report && notifiedReportRef.current !== report) {
      notifiedReportRef.current = report;
      onChecked(cvVersionId);
    }
    if (status !== "success") notifiedReportRef.current = null;
  }, [status, report, cvVersionId, onChecked]);

  const handleConfirm = useCallback(
    (jd: string) => {
      void run({ cvData, jobDescription: jd, provider, model, apiKey });
    },
    [run, cvData, provider, model, apiKey],
  );

  const openDialog = useCallback(() => setDialogOpen(true), []);

  return (
    <div className="relative flex-1 flex flex-col h-full w-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 shrink-0 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="size-9 rounded-lg bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} className="text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-foreground leading-tight">{t("header_title")}</span>
            <span className="text-xs text-muted-foreground truncate">
              {t("header_subtitle", { name: cvDisplayName })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "success" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => { reset(); }}
            >
              <RotateCcw size={14} />
              {t("btn_reset")}
            </Button>
          )}
          {status !== "loading" && (
            <Button
              size="sm"
              className="h-9 px-4 text-xs gap-1.5 font-semibold shadow-md shadow-primary/25 bg-gradient-to-b from-primary to-primary/90"
              onClick={openDialog}
            >
              <Sparkles size={14} />
              {status === "success" ? t("btn_run_again") : t("btn_run")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {status === "idle" && <ATSEmptyState cvName={cvDisplayName} onStart={openDialog} />}

        {status === "loading" && <ATSSkeleton providerHint={t("loading_hint")} />}

        {status === "error" && (
          <ATSAIError
            message={errorMessage}
            details={errorDetails}
            failures={errorFailures}
            onRetry={() => { reset(); openDialog(); }}
          />
        )}

        {status === "success" && report && (
          <div className="flex flex-col gap-5 pb-4">
            <ATSResultsView report={report} />
            <Separator />
            <ATSAdaptPanel
              cvData={cvData}
              jobDescription={lastJobDescription || jobDescription}
              report={report}
              onApplied={onApplyRefinedCV}
              onAdaptingChange={setAdapting}
            />
          </div>
        )}
      </div>

      <ATSJobDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        existingJobDescription={lastJobDescription || jobDescription}
        onConfirm={handleConfirm}
      />

      <AIProgressOverlay active={adapting} title={tAdapt("adapting_ats")} />
    </div>
  );
}
