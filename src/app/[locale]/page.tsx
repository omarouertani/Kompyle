"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CVData, CVLang, CoverLetterData } from "@/types/cv";
import { usePathname, useRouter } from "@/i18n/routing";
import { detectCVLanguage, isCVLang, otherLang } from "@/lib/cv-i18n";
import { requestCVTranslation, setPendingToast, takePendingToast } from "@/lib/cv-import/translate-client";
import CVBuilder from "@/components/cv/CVBuilder";
import CoverLetterBuilder from "@/components/cv/CoverLetterBuilder";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import {
  Sparkles,
  PencilRuler,

  FileText,
  Mail,
  PenTool,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Check,
  CloudOff,
  Plus,
  X,
  ShieldCheck,
  FileUp,
} from "lucide-react";
import { ATSChecker } from "@/components/cv/ats/ATSChecker";
import { useATSCheckedVersions } from "@/hooks/use-ats-checked-versions";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/motion";
import { Skeleton } from "@/components/ui/skeleton";
import { stripHtml } from "@/utils/strip-html";
import { Button } from "@/components/ui/button";
import { PromptInput, PromptInputTextarea, PromptInputToolbar, PromptInputAction } from "@/components/ui/prompt-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarRail, SidebarInset } from "@/components/ui/sidebar";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { rememberActiveProfile, useProfileManager } from "@/hooks/use-profile-manager";
import { useAIProviderConfig } from "@/hooks/use-ai-provider-config";
import { ModelSelect } from "@/components/ai/ModelSelect";
import { ProfileActionsMenu } from "@/components/ProfileActionsMenu";
import { useApiKeys } from "@/hooks/use-api-keys";
import { useAISubmission } from "@/hooks/use-ai-submission";
import { StatusBanner } from "@/components/cv/status-banner";
import { toast } from "sonner";
import { CVImportDialog, type ImportTarget } from "@/components/cv/import/CVImportDialog";
import { applyImportedCV, isSampleCV } from "@/lib/cv-import/apply";
import type { ImportedCV } from "@/lib/cv-import/schema";
import { markUndoableChange } from "@/lib/undoable-change";
import { mockCV } from "@/lib/mock-cv";

const CVPreview = dynamic(() => import("@/components/cv/CVPreview"), {
  ssr: false,
  loading: () => <LoadingSpinner type="cv" />,
});

const CoverLetterPreview = dynamic(() => import("@/components/cv/CoverLetterPreview"), {
  ssr: false,
  loading: () => <LoadingSpinner type="letter" />,
});

function LoadingSpinner({ type }: { type: "cv" | "letter" }) {
  const t = useTranslations("Loading");
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <div className="size-10 rounded-full border-2 border-border flex items-center justify-center">
        <Spinner size={20} className="text-primary" />
      </div>
      <p className="text-sm font-medium">{t(type)}</p>
    </div>
  );
}

type LeftTab = "ai" | "cv-builder" | "letter-builder";
type RightTab = "cv" | "letter" | "ats";

/** Lettre de départ (avant toute génération IA), dans la langue de l'UI. */
function useInitialCoverLetter(): CoverLetterData {
  const t = useTranslations("LetterTemplate");
  const locale = useLocale();
  return {
    recipientName: "",
    recipientCompany: "",
    recipientAddress: "",
    date: new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { year: "numeric", month: "long", day: "numeric" }),
    subject: t("subject"),
    salutation: t("salutation"),
    paragraphs: [t("paragraph_1"), t("paragraph_2")],
    signOff: t("sign_off"),
  };
}

export default function AdaptPage() {
  const t = useTranslations("LeftPanel");
  const tr = useTranslations("RightPanel");
  const tp = useTranslations("Profiles");
  const tAdapt = useTranslations("AIAdapt");
  const te = useTranslations("AIErrors");
  const ti = useTranslations("CVImport");
  const locale = useLocale();

  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>("ai");
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("cv");
  /** Compteur incrémenté pour redéclencher l'ouverture du dialog ATS. */
  const [atsTriggerKey, setAtsTriggerKey] = useState(0);
  const [jobDescription, setJobDescription] = useState("");
  const [refineInstruction, setRefineInstruction] = useState("");
  /** Mode du composeur unifié : "new" = adapter l'offre dans une NOUVELLE version
   *  depuis le CV sélectionné · "continue" = modifier le CV sélectionné EN PLACE. */
  const [composerMode, setComposerMode] = useState<"new" | "continue">("new");
  const [refineHistory, setRefineHistory] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [isRenamingProfile, setIsRenamingProfile] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  /** Import d'un CV existant : dialog + fichier éventuellement déposé sur l'éditeur. */
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const dragDepth = useRef(0);

  const profile = useProfileManager(locale, t);
  const initialCoverLetter = useInitialCoverLetter();
  const router = useRouter();
  const pathname = usePathname();

  // L'historique des raffinages appartient à UN CV/version précis. On le vide dès
  // qu'on change de profil ou de version — sinon l'historique d'un autre CV
  // resterait affiché comme s'il s'appliquait au CV courant. (Remis à zéro
  // pendant le rendu quand la clé change, plutôt que dans un effet.)
  const refineHistoryKey = `${profile.selectedProfile}::${profile.currentProfileId ?? ""}`;
  const [refineHistoryOwner, setRefineHistoryOwner] = useState(refineHistoryKey);
  if (refineHistoryOwner !== refineHistoryKey) {
    setRefineHistoryOwner(refineHistoryKey);
    setRefineHistory([]);
  }

  /** Change d'onglet de droite ; en arrivant sur l'ATS, referme le sidebar s'il
   *  est ouvert (l'utilisateur reste libre de le rouvrir — on ne le bloque pas). */
  const goToRightTab = (tab: RightTab) => {
    setActiveRightTab(tab);
    if (tab === "ats") setIsSidebarOpen(false);
  };

  /** Profil principal actuellement actif (ligne DB), pour renommer/supprimer. */
  const activeMainProfile = profile.profiles.find((p) => p.id === profile.mainProfileId);

  const submitNewProfile = async () => {
    const name = newProfileName.trim();
    if (!name) return;
    setIsCreatingProfile(false);
    setNewProfileName("");
    await profile.createProfile(name);
    // Ouvre directement l'éditeur manuel pour remplir le CV vierge
    setActiveLeftTab("cv-builder");
  };

  const submitRename = async () => {
    if (!activeMainProfile) return;
    const ok = await profile.renameProfile(activeMainProfile.id, renameValue);
    setIsRenamingProfile(false);
    setRenameValue("");
    if (!ok) setProfileActionError(tp("rename_error"));
  };

  const handleDeleteProfile = () => {
    if (!activeMainProfile) return;
    setProfileActionError(null);
    setConfirmDeleteOpen(true);
  };

  const confirmDeleteProfile = async () => {
    setConfirmDeleteOpen(false);
    if (!activeMainProfile) return;
    const ok = await profile.deleteProfile(activeMainProfile.id);
    if (!ok) setProfileActionError(tp("delete_error"));
  };

  const openImport = (file: File | null = null) => {
    setImportFile(file);
    setImportOpen(true);
  };

  /** Bascule l'interface dans la langue `lang` (le profil actif est rechargé
   *  dans cette langue). Le toast éventuel est réaffiché après la bascule. */
  const switchAppLanguage = (lang: CVLang, message: string, description?: string) => {
    setPendingToast(message, description);
    router.replace(pathname, { locale: lang });
  };

  // Toast laissé par une bascule de langue (import d'un CV dans l'autre langue).
  useEffect(() => {
    const pending = takePendingToast();
    if (pending) toast.success(pending.message, { description: pending.description });
  }, []);

  /** Applique un CV importé. Sa langue est détectée ; la version dans l'autre
   *  langue est générée par l'IA, et les DEUX versions sont enregistrées dans le
   *  profil (une ligne par langue) : sélectionner FR/EN dans l'app affiche la
   *  bonne. Si le CV n'est pas dans la langue de l'app, l'app bascule dans sa
   *  langue. Mode « replace » : remplace TOUT le contenu du CV courant (annulable
   *  par Ctrl+Z / le toast quand la langue ne change pas) ; « new » : nouveau profil. */
  const handleImportApply = async (imported: ImportedCV, target: ImportTarget): Promise<boolean> => {
    const uiLang: CVLang = isCVLang(locale) ? locale : "fr";
    const lang: CVLang = isCVLang(imported.language) ? imported.language : detectCVLanguage(imported);
    const other = otherLang(lang);
    const template = profile.selectedTemplate;

    const loadingId = toast.loading(ti("toast_translating", { lang: ti(`lang_${other}`) }));
    const translated = await requestCVTranslation({ ...imported, language: lang }, other, {
      provider: aiConfig.provider,
      model: aiConfig.model,
      apiKey: apiKeys.keys[aiConfig.provider],
    });
    toast.dismiss(loadingId);
    if (!translated) toast.warning(ti("toast_translate_failed", { lang: ti(`lang_${other}`) }));

    const sources: Partial<Record<CVLang, ImportedCV>> = { [lang]: imported, ...(translated ? { [other]: translated } : {}) };
    const build = (base: CVData): Partial<Record<CVLang, CVData>> => {
      const out: Partial<Record<CVLang, CVData>> = {};
      for (const [l, cv] of Object.entries(sources) as [CVLang, ImportedCV][]) {
        out[l] = { ...applyImportedCV(base, cv), language: l };
      }
      return out;
    };
    const switchedHint = lang !== uiLang ? ti("toast_lang_switched", { lang: ti(`lang_${lang}`) }) : undefined;

    // Nouveau profil (ou aucun profil enregistré à remplacer) : une ligne par langue.
    if (target.mode === "new" || !profile.selectedProfile) {
      const name = target.mode === "new" ? target.profileName : stripHtml(imported.personalInfo.name).trim() || ti("default_profile_name");
      const sample = mockCV(template, lang);
      const base: CVData = {
        ...sample,
        layout: sample.layout && { ...sample.layout, theme: profile.currentCV.layout?.theme ?? sample.layout.theme },
      };
      const slug = await profile.createProfile(name, template, build(base));
      if (!slug) {
        toast.error(ti("toast_new_error"));
        return false;
      }
      setActiveRightTab("cv");
      const message = ti("toast_new_success", { name });
      if (lang !== uiLang) switchAppLanguage(lang, message, switchedHint);
      else toast.success(message);
      return true;
    }

    const slug = profile.selectedProfile;
    const versions = build(profile.currentCV);

    if (lang !== uiLang) {
      // L'app bascule dans la langue du CV : les deux versions sont enregistrées
      // AVANT la bascule (la page est rechargée dans l'autre langue).
      const saved = await Promise.all(
        (Object.entries(versions) as [CVLang, CVData][]).map(([l, cv]) => profile.saveLocaleVersion(slug, l, cv, template))
      );
      if (saved.some((ok) => !ok)) {
        toast.error(ti("toast_new_error"));
        return false;
      }
      if (versions[uiLang]) profile.setCurrentCV(versions[uiLang]);
      rememberActiveProfile(slug);
      switchAppLanguage(lang, ti("toast_applied"), switchedHint);
      return true;
    }

    // Même langue que l'app : la version traduite est enregistrée en arrière-plan.
    if (versions[other]) {
      profile.saveLocaleVersion(slug, other, versions[other], template).then((ok) => {
        if (!ok) toast.warning(ti("toast_translate_failed", { lang: ti(`lang_${other}`) }));
      });
    }
    const previousCV = profile.currentCV;
    const previousLetter = profile.coverLetterData;
    profile.setCurrentCV(markUndoableChange(versions[lang] ?? { ...applyImportedCV(previousCV, imported), language: lang }));
    // La lettre reprend le modèle vierge : elle utilise le nom et le contact importés.
    profile.setCoverLetterData(null);
    setActiveRightTab("cv");
    toast.success(ti("toast_applied"), {
      description: ti("toast_applied_hint"),
      duration: 10_000,
      action: {
        label: ti("undo"),
        onClick: () => {
          profile.setCurrentCV(previousCV);
          profile.setCoverLetterData(previousLetter);
        },
      },
    });
    return true;
  };

  /** Glisser-déposer d'un fichier sur l'aperçu : ouvre l'import (lecture locale). */
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");
  const fileDropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current++;
      setFileDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setFileDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setFileDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) openImport(file);
    },
  };
  const aiConfig = useAIProviderConfig();
  const apiKeys = useApiKeys();
  const atsChecked = useATSCheckedVersions();

  // ID de la version de CV affichée (CV principal ou adaptation sélectionnée).
  const currentCvVersionId = profile.currentProfileId ?? profile.mainProfileId ?? null;

  // « Prénom Nom — Titre · nom-de-version » : ce que l'utilisateur reconnaît
  // dans le sélecteur de versions et le menu de profil, pas un identifiant DB.
  const cvDisplayName = (() => {
    const pi = profile.currentCV.personalInfo;
    // Les champs CV peuvent porter du HTML inline (style appliqué sur le canvas) :
    // on le retire ici car ce libellé s'affiche en texte brut (sélecteur, ATS, menu).
    const fullName = stripHtml(pi.name || "").trim() || tp("active_label");
    const role = stripHtml(pi.role || "").trim();
    const isAdaptation = !!profile.currentProfileId && profile.currentProfileId !== profile.mainProfileId;
    const versionName = isAdaptation
      ? stripHtml(profile.versions.find((v) => v.id === profile.currentProfileId)?.name || "")
      : tr("tab_cv");
    const head = role ? `${fullName} — ${role}` : fullName;
    return versionName ? `${head} · ${versionName}` : head;
  })();

  const { handleAdaptCV, handleGenerateLetter, handleRefineCV, handleRefineLetter, cancel: aiCancel } = useAISubmission({
    jobDescription,
    provider: aiConfig.provider,
    model: aiConfig.model,
    apiKey: apiKeys.keys[aiConfig.provider],
    currentCV: profile.currentCV,
    coverLetterData: profile.coverLetterData,
    locale,
    selectedProfile: profile.selectedProfile,
    currentProfileId: profile.currentProfileId,
    selectedTemplate: profile.selectedTemplate,
    applyAdaptation: profile.applyAdaptation,
    setCurrentCV: profile.setCurrentCV,
    setCoverLetterData: profile.setCoverLetterData,
    setActiveRightTab,
    setStatus: profile.setStatus,
    setStatusMessage: profile.setStatusMessage,
    setStatusDetails: profile.setStatusDetails,
    setLoadingType: profile.setLoadingType,
    t,
    tAdapt,
  });

  const submitRefine = async (target: "cv" | "letter") => {
    const instruction = refineInstruction.trim();
    if (!instruction) return;
    const ok = target === "cv"
      ? await handleRefineCV(instruction)
      : await handleRefineLetter(instruction);
    if (ok) {
      setRefineHistory((prev) => [...prev, instruction]);
      setRefineInstruction("");
    }
  };

  const renderLeftContent = () => {
    switch (activeLeftTab) {
      case "ai": {
        // Composeur unifié. "continue" (modif en place) n'est proposé qu'une fois
        // qu'un document existe ; sinon on force "new" (nouvelle version depuis l'offre).
        const canContinue = profile.isAdapted || !!profile.coverLetterData;
        const mode: "new" | "continue" = canContinue ? composerMode : "new";
        const composerValue = mode === "new" ? jobDescription : refineInstruction;
        const onComposerChange = mode === "new" ? setJobDescription : setRefineInstruction;
        const isLoading = profile.status === "loading";
        return (
          <div className="flex flex-col gap-5 p-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-1.5">{mode === "new" ? t("title") : t("refine_title")}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{mode === "new" ? t("subtitle") : t("refine_subtitle")}</p>
            </div>

            {/* Groupe composeur : saisie + choix du mode + alerte clé, espacés
                serré ensemble (plus de marges négatives « -mt-3 » bricolées). */}
            <div className="flex flex-col gap-2.5">
            {/* ── Saisie du poste : PromptInput réutilisable, actions intégrées ── */}
            <PromptInput>
              <PromptInputTextarea
                placeholder={mode === "new" ? t("placeholder") : t("refine_placeholder")}
                value={composerValue}
                onChange={(e) => onComposerChange(e.target.value)}
                disabled={isLoading}
                minHeight={150}
                maxHeight={300}
              />
              <PromptInputToolbar className="justify-between">
                {/* Modèle IA en icône-seule, à gauche (menu compact, ouvert vers le bas). */}
                <ModelSelect
                  compact
                  model={aiConfig.model}
                  onModelChange={aiConfig.selectModel}
                  disabled={isLoading}
                />
                <div className="flex items-center gap-1.5">
                  {isLoading ? (
                    /* Pendant le travail de l'IA : un seul bouton pour ANNULER. */
                    <PromptInputAction
                      variant="outline"
                      label={t("btn_cancel")}
                      icon={<X className="size-4" />}
                      onClick={aiCancel}
                    />
                  ) : (
                    <>
                      <PromptInputAction
                        variant="outline"
                        label={mode === "new" ? t("btn_letter") : t("btn_refine_letter")}
                        icon={<Mail className="size-4" />}
                        onClick={() => {
                          if (mode === "new") { setRefineHistory([]); handleGenerateLetter(); }
                          else submitRefine("letter");
                        }}
                        disabled={!composerValue.trim() || (mode === "continue" && !profile.coverLetterData)}
                      />
                      <PromptInputAction
                        variant="default"
                        label={mode === "new" ? t("btn_adapt") : t("btn_refine_cv")}
                        icon={mode === "new" ? <Sparkles className="size-4" /> : <FileText className="size-4" />}
                        onClick={() => {
                          if (mode === "new") { setRefineHistory([]); handleAdaptCV(); }
                          else submitRefine("cv");
                        }}
                        disabled={!composerValue.trim() || (mode === "continue" && !profile.isAdapted)}
                      />
                    </>
                  )}
                </div>
              </PromptInputToolbar>
            </PromptInput>

            {/* Choix du mode : NOUVELLE version depuis l'offre · ou CONTINUER sur ce CV.
                "Continuer" (modif en place) n'est dispo qu'une fois qu'un document
                existe (CV adapté / lettre) — sinon désactivé, on reste en "nouvelle". */}
            <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/50 p-1">
              <button
                type="button"
                onClick={() => setComposerMode("new")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  mode === "new" ? "bg-card text-primary shadow-sm ring-1 ring-primary/15" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles size={13} />
                {t("mode_new")}
              </button>
              <button
                type="button"
                onClick={() => canContinue && setComposerMode("continue")}
                disabled={!canContinue}
                title={canContinue ? undefined : t("mode_continue_hint")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                  mode === "continue" ? "bg-card text-primary shadow-sm ring-1 ring-primary/15" : "text-muted-foreground hover:text-foreground",
                  !canContinue && "cursor-not-allowed opacity-40 hover:text-muted-foreground",
                )}
              >
                <FileText size={13} />
                {t("mode_continue")}
              </button>
            </div>

            {/* Alerte clé API manquante pour le provider du modèle choisi. */}
            {!apiKeys.keys[aiConfig.provider] && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-warning leading-tight pl-0.5">
                {te("missing_key")}
              </span>
            )}
            </div>

            {/* Historique des modifications déjà appliquées (mode "continuer"). */}
            {mode === "continue" && refineHistory.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {refineHistory.map((instruction, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                    <Check size={12} className="text-success mt-0.5 shrink-0" />
                    <span className="leading-snug">{instruction}</span>
                  </div>
                ))}
              </div>
            )}

            <StatusBanner status={profile.status} message={profile.statusMessage} details={profile.statusDetails} />
          </div>
        );
      }
      case "cv-builder":
        return (
          <div className="p-6">
            <CVBuilder data={profile.currentCV} onChange={profile.setCurrentCV} />
          </div>
        );
      case "letter-builder":
        return (
          <div className="p-6">
            <CoverLetterBuilder
              personalInfo={profile.currentCV.personalInfo}
              data={profile.coverLetterData || initialCoverLetter}
              onChange={(newData) => {
                profile.setCoverLetterData(newData);
                if (activeRightTab !== "letter") setActiveRightTab("letter");
              }}
            />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      <Header />

      {/* Confirmation de suppression de profil (thème de l'app, pas window.confirm) */}
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        destructive
        title={tp("delete_title")}
        description={activeMainProfile ? tp("delete_confirm", { name: activeMainProfile.name }) : undefined}
        cancelLabel={tp("cancel")}
        confirmLabel={tp("confirm_delete")}
        onConfirm={confirmDeleteProfile}
      />

      <CVImportDialog
        open={importOpen}
        onOpenChange={(o) => { setImportOpen(o); if (!o) setImportFile(null); }}
        initialFile={importFile}
        provider={aiConfig.provider}
        model={aiConfig.model}
        apiKey={apiKeys.keys[aiConfig.provider]}
        canCreateProfile={!!profile.mainProfileId}
        onApply={handleImportApply}
      />

      {/* Feedback global : barre de progression pendant une action IA */}
      <div className="relative h-0.5 shrink-0 z-30">
        {profile.status === "loading" && (
          <div className="motion-bar-indeterminate absolute inset-x-0 top-0 h-0.5" role="progressbar" aria-label={t("status_loading_cv")} />
        )}
      </div>

      <SidebarProvider
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        style={{ "--sidebar-width": "480px" } as React.CSSProperties}
        className="flex-1 flex overflow-hidden w-full !min-h-0 !h-full"
      >
        <Sidebar side="left" variant="sidebar" className="overflow-hidden border-r border-border !top-14 !h-[calc(100svh-3.5rem)]">
          <SidebarHeader className="px-3 pt-3 pb-2 border-b border-border shrink-0 bg-sidebar flex flex-col gap-2.5">
            <div className="flex flex-col gap-2.5 rounded-xl bg-card/60 p-2.5 border border-border/60 shadow-sm">
              {/* Ligne 1 : libellé + statut de sauvegarde (intégré, plus de barre flottante) */}
              <div className="flex items-center justify-between gap-2 pl-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{tp("active_label")}</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 text-[11px] font-medium">
                    {profile.saveStatus === "saving" && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Spinner size={12} />
                        {tp("saving")}
                      </span>
                    )}
                    {profile.saveStatus === "saved" && (
                      <span className="flex items-center gap-1 text-success">
                        <Check size={12} />
                        {tp("saved")}
                      </span>
                    )}
                    {profile.saveStatus === "error" && (
                      <span className="flex items-center gap-1 text-destructive">
                        <CloudOff size={12} />
                        {tp("save_error")}
                      </span>
                    )}
                  </div>
                  <Button
                    variant={profile.hasUnsavedChanges ? "default" : "ghost"}
                    size="xs"
                    className={cn(
                      "h-7 px-2.5 text-xs gap-1.5 rounded-lg transition-all",
                      !profile.hasUnsavedChanges && "text-muted-foreground",
                    )}
                    onClick={profile.handleSave}
                    disabled={!profile.hasUnsavedChanges || profile.saveStatus === "saving"}
                  >
                    <Save size={12} />
                    {tp("save")}
                  </Button>
                </div>
              </div>

              {/* Ligne 2 : profils + créer + menu d'actions (renommer/supprimer regroupés) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Pendant le chargement initial, un skeleton discret au lieu d'un
                    faux onglet "Omar" codé en dur (qui ne correspondait à aucun
                    profil réel). Une fois chargé : les profils réels de la base. */}
                {profile.initialLoading && profile.profiles.length === 0 ? (
                  <Skeleton className="h-7 w-20 rounded-lg" aria-hidden />
                ) : (
                  [...new Map(profile.profiles.map((p) => [p.slug, p])).values()].map((p) => (
                    <Button
                      key={p.slug}
                      variant={profile.selectedProfile === p.slug ? "default" : "ghost"}
                      size="xs"
                      className={cn(
                        "h-7 px-3 text-xs font-semibold rounded-lg transition-all",
                        profile.selectedProfile === p.slug
                          ? "shadow-sm shadow-primary/25"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted",
                      )}
                      onClick={() => { setIsRenamingProfile(false); setProfileActionError(null); profile.handleProfileChange(p.slug); }}
                    >
                      {p.name.split(" ")[0]}
                    </Button>
                  ))
                )}
                {isCreatingProfile ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitNewProfile();
                        if (e.key === "Escape") { setIsCreatingProfile(false); setNewProfileName(""); }
                      }}
                      placeholder={tp("new_placeholder")}
                      className="h-7 w-32 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
                    />
                    <Button variant="default" size="xs" className="size-7 p-0" onClick={submitNewProfile} disabled={!newProfileName.trim()} title={tp("create_blank")}>
                      <Check size={13} />
                    </Button>
                    <Button variant="ghost" size="xs" className="size-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setIsCreatingProfile(false); setNewProfileName(""); }} title={tp("cancel")}>
                      <X size={13} />
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Séparateur léger avant les actions, si des profils sont listés */}
                    {profile.profiles.length > 0 && <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />}
                    <Button
                      variant="ghost"
                      size="xs"
                      className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => setIsCreatingProfile(true)}
                      title={tp("new_profile_tooltip")}
                    >
                      <Plus size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => openImport()}
                      title={ti("open_tooltip")}
                      aria-label={ti("open_tooltip")}
                    >
                      <FileUp size={14} />
                    </Button>
                    {activeMainProfile && !isRenamingProfile && (
                      <ProfileActionsMenu
                        onRename={() => { setProfileActionError(null); setRenameValue(activeMainProfile.name); setIsRenamingProfile(true); }}
                        onDelete={handleDeleteProfile}
                        renameLabel={tp("rename_tooltip")}
                        deleteLabel={tp("delete_tooltip")}
                        menuLabel={tp("more_actions")}
                        onImport={() => openImport()}
                        importLabel={ti("menu_import")}
                      />
                    )}
                  </>
                )}
              </div>

              {isRenamingProfile && activeMainProfile && (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename();
                      if (e.key === "Escape") { setIsRenamingProfile(false); setRenameValue(""); }
                    }}
                    placeholder={tp("rename_placeholder")}
                    className="h-7 flex-1 px-2.5 text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
                  />
                  <Button variant="default" size="xs" className="size-7 p-0" onClick={submitRename} disabled={!renameValue.trim()} title={tp("rename_tooltip")}>
                    <Check size={13} />
                  </Button>
                  <Button variant="ghost" size="xs" className="size-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => { setIsRenamingProfile(false); setRenameValue(""); }} title={tp("cancel")}>
                    <X size={13} />
                  </Button>
                </div>
              )}

              {profileActionError && (
                <p className="text-[10px] text-destructive px-1.5">{profileActionError}</p>
              )}
            </div>

            <Tabs value={activeLeftTab} onValueChange={(v) => setActiveLeftTab(v as LeftTab)}>
              <TabsList className="w-full h-9 bg-muted/60 gap-0.5">
                <TabsTrigger value="ai" className="flex-1 gap-1.5 text-xs font-medium">
                  <Sparkles size={13} />
                  {t("tab_ai")}
                </TabsTrigger>
                <TabsTrigger value="cv-builder" className="flex-1 gap-1.5 text-xs font-medium">
                  <PencilRuler size={13} />
                  {t("tab_cv")}
                </TabsTrigger>
                <TabsTrigger value="letter-builder" className="flex-1 gap-1.5 text-xs font-medium">
                  <PenTool size={13} />
                  {t("tab_letter")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </SidebarHeader>

          <SidebarContent className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar bg-sidebar">
            {renderLeftContent()}
          </SidebarContent>
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="flex-1 flex flex-col bg-background z-0 overflow-hidden min-w-0 m-0! rounded-none! !w-auto">
          <div className="relative px-6 py-2.5 border-b border-border bg-card/50 flex justify-center items-center shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute left-4 size-8 text-muted-foreground hover:text-foreground"
              title={isSidebarOpen ? tr("collapse_sidebar") : tr("expand_sidebar")}
            >
              {isSidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </Button>

            <Tabs value={activeRightTab} onValueChange={(v) => goToRightTab(v as RightTab)}>
              <TabsList className="w-[420px]">
                <TabsTrigger value="cv" className="flex-1 gap-1.5">
                  <FileText size={14} />
                  {tr("tab_cv")}
                </TabsTrigger>
                <TabsTrigger value="letter" className="flex-1 gap-1.5">
                  <Mail size={14} />
                  {tr("tab_letter")}
                </TabsTrigger>
                <TabsTrigger value="ats" className="flex-1 gap-1.5">
                  <ShieldCheck size={14} />
                  {tr("tab_ats")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="relative flex-1 overflow-hidden p-5 flex flex-col" {...fileDropHandlers}>
            {fileDragOver && (
              <div className="pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary bg-background/85 text-center backdrop-blur-sm">
                <FileUp size={30} className="text-primary" />
                <p className="text-sm font-semibold text-foreground">{ti("drop_overlay")}</p>
                <p className="text-xs text-muted-foreground">{ti("drop_formats")}</p>
              </div>
            )}
            {/* Tant que le vrai CV n'est pas résolu au DÉMARRAGE (localStorage →
                BD), on affiche un loader au lieu du CV d'EXEMPLE : c'est ce flash
                du mauvais contenu qui donnait l'impression de « désordre ». Les
                changements de profil ultérieurs se font sur place (pas de loader). */}
            {activeRightTab === "cv" && profile.initialLoading && <LoadingSpinner type="cv" />}
            {activeRightTab === "cv" && !profile.initialLoading && (
              // Conteneur flex : le bandeau « CV d'exemple » au-dessus ne doit
              // pas pousser l'aperçu (h-full) hors de la zone visible.
              <div className="flex min-h-0 flex-1 flex-col">
              <CVPreview
                data={profile.currentCV}
                onChange={profile.setCurrentCV}
                originalData={profile.isAdapted ? profile.originalCV : null}
                template={profile.selectedTemplate}
                onTemplateChange={profile.changeTemplate}
                isAdapting={profile.loadingType === "cv"}
                versions={profile.versions}
                mainProfileId={profile.mainProfileId}
                currentProfileId={profile.currentProfileId}
                onVersionChange={profile.selectVersion}
                onDeleteVersion={profile.deleteVersion}
                onOpenATS={() => {
                  goToRightTab("ats");
                  setAtsTriggerKey((k) => k + 1);
                }}
                atsButtonShine={!atsChecked.isChecked(currentCvVersionId)}
                onImportSample={isSampleCV(profile.currentCV) ? () => openImport() : undefined}
              />
              </div>
            )}

            {activeRightTab === "letter" && (
              <CoverLetterPreview
                data={profile.coverLetterData || initialCoverLetter}
                personalInfo={profile.currentCV.personalInfo}
                theme={profile.currentCV.layout?.theme}
                isAdapting={profile.loadingType === "letter"}
              />
            )}

            {activeRightTab === "ats" && (
              <ATSChecker
                cvData={profile.currentCV}
                cvDisplayName={cvDisplayName}
                cvVersionId={currentCvVersionId}
                jobDescription={jobDescription}
                triggerKey={atsTriggerKey}
                onChecked={atsChecked.markChecked}
                onApplyRefinedCV={(cv) => {
                  // L'adaptation depuis l'ATS s'applique au CV courant ET ouvre
                  // directement l'aperçu du CV adapté.
                  profile.setCurrentCV(cv);
                  setActiveRightTab("cv");
                }}
              />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
