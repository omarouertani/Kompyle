"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, RotateCcw, ShieldCheck } from "lucide-react";
import type { CVData } from "@/types/cv";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useATSCheck } from "@/hooks/use-ats-check";
import { providerForModel, DEFAULT_MODEL } from "@/hooks/use-ai-provider-config";
import { useApiKeys } from "@/hooks/use-api-keys";
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
  triggerKey,
  onChecked,
  onApplyRefinedCV,
}: ATSCheckerProps) {
  const t = useTranslations("ATS");
  const tAdapt = useTranslations("AIAdapt");
  const [adapting, setAdapting] = useState(false);
  // Modèle IA propre à l'audit ATS (indépendant du sélecteur global du sidebar).
  const { keys } = useApiKeys();
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const provider = providerForModel(model);
  const apiKey = keys[provider];
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
          <div className="flex flex-col min-w-0 gap-1">
            <span className="text-sm font-semibold text-foreground leading-tight">{t("header_title")}</span>
            <span
              className="inline-flex w-fit max-w-full items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground truncate"
              title={cvDisplayName}
            >
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
          {/* Bouton run UNIQUEMENT après un audit (relancer). En idle, seul le
              CTA central de l'empty-state lance l'audit → pas de doublon. */}
          {status === "success" && (
            <Button
              size="sm"
              className="h-9 px-4 text-xs gap-1.5 font-semibold shadow-md shadow-primary/25 bg-gradient-to-b from-primary to-primary/90"
              onClick={openDialog}
            >
              <Sparkles size={14} />
              {t("btn_run_again")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {status === "idle" && <ATSEmptyState onStart={openDialog} />}

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
        model={model}
        onModelChange={setModel}
        onConfirm={handleConfirm}
      />

      <AIProgressOverlay active={adapting} title={tAdapt("adapting_ats")} />
    </div>
  );
}
