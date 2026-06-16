"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import type { CoverLetterData } from "@/types/cv";
import CVBuilder from "@/components/cv/CVBuilder";
import CoverLetterBuilder from "@/components/cv/CoverLetterBuilder";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import {
  Sparkles,
  PencilRuler,
  RotateCcw,
  Loader2,
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
  Pencil,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { ATSChecker } from "@/components/cv/ats/ATSChecker";
import { useATSCheckedVersions } from "@/hooks/use-ats-checked-versions";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarRail, SidebarInset } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfileManager } from "@/hooks/use-profile-manager";
import { useAIProviderConfig, PROVIDER_MODELS, PROVIDER_META } from "@/hooks/use-ai-provider-config";
import { useApiKeys } from "@/hooks/use-api-keys";
import { ApiKeysDialog } from "@/components/ApiKeysDialog";
import type { AIProvider } from "@/types/cv";
import { useAISubmission } from "@/hooks/use-ai-submission";
import { StatusBanner } from "@/components/cv/status-banner";

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
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
      <p className="text-sm font-medium">{t(type)}</p>
    </div>
  );
}

type LeftTab = "ai" | "cv-builder" | "letter-builder";
type RightTab = "cv" | "letter" | "ats";

const initialCoverLetter: CoverLetterData = {
  recipientName: "",
  recipientCompany: "",
  recipientAddress: "",
  date: new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }),
  subject: "Candidature",
  salutation: "Madame, Monsieur,",
  paragraphs: [
    "C'est avec un grand intérêt que je vous soumets ma candidature.",
    "Mes expériences précédentes m'ont permis de développer les compétences nécessaires pour ce poste."
  ],
  signOff: "Je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.",
};

export default function AdaptPage() {
  const t = useTranslations("LeftPanel");
  const tr = useTranslations("RightPanel");
  const tp = useTranslations("Profiles");
  const tAdapt = useTranslations("AIAdapt");
  const te = useTranslations("AIErrors");
  const locale = useLocale();

  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>("ai");
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("cv");
  /** Compteur incrémenté pour redéclencher l'ouverture du dialog ATS. */
  const [atsTriggerKey, setAtsTriggerKey] = useState(0);
  const [jobDescription, setJobDescription] = useState("");
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refineHistory, setRefineHistory] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [isRenamingProfile, setIsRenamingProfile] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [profileActionError, setProfileActionError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const profile = useProfileManager(locale, t);

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
  const aiConfig = useAIProviderConfig();
  const apiKeys = useApiKeys();
  const atsChecked = useATSCheckedVersions();

  // ID de la version de CV affichée (CV principal ou adaptation sélectionnée).
  const currentCvVersionId = profile.currentProfileId ?? profile.mainProfileId ?? null;

  // « Prénom Nom — Titre · nom-de-version » : ce que l'utilisateur reconnaît
  // dans le sélecteur de versions et le menu de profil, pas un identifiant DB.
  const cvDisplayName = (() => {
    const pi = profile.currentCV.personalInfo;
    const fullName = pi.name?.trim() || tp("active_label");
    const role = pi.role?.trim();
    const isAdaptation = !!profile.currentProfileId && profile.currentProfileId !== profile.mainProfileId;
    const versionName = isAdaptation
      ? profile.versions.find((v) => v.id === profile.currentProfileId)?.name
      : tr("tab_cv");
    const head = role ? `${fullName} — ${role}` : fullName;
    return versionName ? `${head} · ${versionName}` : head;
  })();

  const { handleAdaptCV, handleGenerateLetter, handleRefineCV, handleRefineLetter } = useAISubmission({
    jobDescription,
    provider: aiConfig.provider,
    model: aiConfig.model,
    apiKey: apiKeys.keys[aiConfig.provider],
    currentCV: profile.currentCV,
    coverLetterData: profile.coverLetterData,
    locale,
    selectedProfile: profile.selectedProfile,
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
      case "ai":
        return (
          <div className="flex flex-col gap-6 p-6">
            <div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground mb-1.5">{t("title")}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("subtitle")}</p>
            </div>

            <Textarea
              className="min-h-[180px] resize-y text-sm leading-relaxed"
              placeholder={t("placeholder")}
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={profile.status === "loading"}
            />

            {/* ── Sélection unifiée du modèle IA (fournisseur + modèle) ── */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
                {t("label_model")}
              </span>
              <Select value={aiConfig.model} onValueChange={(val) => val && aiConfig.selectModel(val)} disabled={profile.status === "loading"}>
                <SelectTrigger className="w-full h-11 rounded-xl border border-border bg-muted/40 hover:bg-muted/60 transition-colors px-3">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-background"
                      style={{ backgroundColor: PROVIDER_META[aiConfig.provider].color, boxShadow: `0 0 0 2px ${PROVIDER_META[aiConfig.provider].color}30` }}
                    />
                    <span className="flex flex-col items-start min-w-0 leading-tight">
                      <span className="text-[10px] text-muted-foreground truncate">{PROVIDER_META[aiConfig.provider].label}</span>
                      <SelectValue className="text-sm font-semibold" />
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false} className="border border-border shadow-xl rounded-xl p-1.5">
                  {(Object.keys(PROVIDER_MODELS) as AIProvider[]).map((prov) => (
                    <SelectGroup key={prov}>
                      <SelectLabel className="flex items-center gap-2 px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span className="size-2 rounded-full" style={{ backgroundColor: PROVIDER_META[prov].color }} />
                        {PROVIDER_META[prov].label}
                      </SelectLabel>
                      {PROVIDER_MODELS[prov].map((m) => (
                        <SelectItem key={m.model} value={m.model} className="cursor-pointer rounded-lg text-sm">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between gap-2">
                <ApiKeysDialog />
                {!apiKeys.keys[aiConfig.provider] && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 text-right leading-tight">
                    {te("missing_key")}
                  </span>
                )}
              </div>
            </div>

            {/* ── Hiérarchie d'actions : Adapter CV (primaire) · Créer Lettre (secondaire) ── */}
            <div className="flex flex-col gap-2.5">
              <Button
                size="lg"
                onClick={() => { setRefineHistory([]); handleAdaptCV(); }}
                disabled={profile.status === "loading" || !jobDescription.trim()}
                className="w-full gap-2 h-12 text-sm font-semibold shadow-md shadow-primary/25 bg-gradient-to-b from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/30 transition-all"
              >
                {profile.status === "loading" && profile.loadingType === "cv" ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Sparkles size={17} />
                )}
                {t("btn_adapt")}
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 h-10 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                onClick={() => { setRefineHistory([]); handleGenerateLetter(); }}
                disabled={profile.status === "loading" || !jobDescription.trim()}
              >
                {profile.status === "loading" && profile.loadingType === "letter" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Mail size={16} />
                )}
                {t("btn_letter")}
              </Button>
            </div>

            {/* ── Discussion continue : modifier le document généré ── */}
            {(profile.isAdapted || profile.coverLetterData) && (
              <div className="flex flex-col gap-3 border border-primary/20 bg-primary/[0.03] rounded-xl p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                    <Sparkles size={14} className="text-primary" />
                    {t("refine_title")}
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("refine_subtitle")}</p>
                </div>

                {refineHistory.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {refineHistory.map((instruction, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                        <Check size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                        <span className="leading-snug">{instruction}</span>
                      </div>
                    ))}
                  </div>
                )}

                <Textarea
                  className="min-h-[72px] resize-y text-sm leading-relaxed"
                  placeholder={t("refine_placeholder")}
                  value={refineInstruction}
                  onChange={(e) => setRefineInstruction(e.target.value)}
                  disabled={profile.status === "loading"}
                />

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => submitRefine("cv")}
                    disabled={profile.status === "loading" || !refineInstruction.trim() || !profile.isAdapted}
                  >
                    <FileText size={14} />
                    {t("btn_refine_cv")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-primary border-primary/20 hover:bg-primary/5"
                    onClick={() => submitRefine("letter")}
                    disabled={profile.status === "loading" || !refineInstruction.trim() || !profile.coverLetterData}
                  >
                    <Mail size={14} />
                    {t("btn_refine_letter")}
                  </Button>
                </div>
              </div>
            )}

            {(profile.isAdapted || profile.coverLetterData) && profile.status !== "loading" && (
              <Button
                variant="ghost"
                onClick={() => {
                  profile.handleReset();
                  setRefineHistory([]);
                  setRefineInstruction("");
                }}
                className="text-muted-foreground gap-1.5"
                size="sm"
              >
                <RotateCcw size={14} />
                {t("btn_reset")}
              </Button>
            )}

            <StatusBanner status={profile.status} message={profile.statusMessage} details={profile.statusDetails} />
          </div>
        );
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

      {/* Feedback global : barre de progression pendant une action IA */}
      <div className="relative h-0.5 shrink-0 z-30">
        {profile.status === "loading" && (
          <div className="progress-indeterminate absolute inset-x-0 top-0 h-0.5" role="progressbar" aria-label={t("status_loading_cv")} />
        )}
      </div>

      <SidebarProvider
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        style={{ "--sidebar-width": "480px" } as React.CSSProperties}
        className="flex-1 flex overflow-hidden w-full !min-h-0 !h-full"
      >
        <Sidebar side="left" variant="sidebar" className="border-r border-border !top-14 !h-[calc(100svh-3.5rem)]">
          <SidebarHeader className="px-3 pt-3 pb-2 border-b border-border shrink-0 bg-sidebar flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5 bg-muted/40 rounded-lg p-1.5 border border-border/40">
              <div className="flex items-center justify-between px-1 gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-1 shrink-0">{tp("active_label")}</span>
                <div className="flex gap-1 items-center flex-wrap justify-end">
                  {(profile.profiles.length > 0
                    ? [...new Map(profile.profiles.map((p) => [p.slug, p])).values()]
                    : [{ slug: "omar", name: "Omar" }]
                  ).map((p) => (
                    <Button
                      key={p.slug}
                      variant={profile.selectedProfile === p.slug ? "default" : "ghost"}
                      size="xs"
                      className={cn("h-6 px-3 text-xs font-semibold rounded-md transition-all", profile.selectedProfile === p.slug ? "shadow-sm" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => { setIsRenamingProfile(false); setProfileActionError(null); profile.handleProfileChange(p.slug); }}
                    >
                      {p.name.split(" ")[0]}
                    </Button>
                  ))}
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
                        className="h-6 w-28 px-2 text-xs rounded-md border border-border bg-input-bg focus:outline-none focus:ring-1 focus:ring-ring/40"
                      />
                      <Button variant="default" size="xs" className="h-6 px-2 text-xs" onClick={submitNewProfile} disabled={!newProfileName.trim()} title={tp("create_blank")}>
                        <Check size={12} />
                      </Button>
                      <Button variant="ghost" size="xs" className="h-6 px-1.5 text-muted-foreground" onClick={() => { setIsCreatingProfile(false); setNewProfileName(""); }}>
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setIsCreatingProfile(true)}
                        title={tp("new_profile_tooltip")}
                      >
                        <Plus size={12} />
                      </Button>
                      {activeMainProfile && !isRenamingProfile && (
                        <>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => { setProfileActionError(null); setRenameValue(activeMainProfile.name); setIsRenamingProfile(true); }}
                            title={tp("rename_tooltip")}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            className="h-6 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={handleDeleteProfile}
                            title={tp("delete_tooltip")}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isRenamingProfile && activeMainProfile && (
                <div className="flex items-center gap-1 px-1">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename();
                      if (e.key === "Escape") { setIsRenamingProfile(false); setRenameValue(""); }
                    }}
                    placeholder={tp("rename_placeholder")}
                    className="h-6 flex-1 px-2 text-xs rounded-md border border-border bg-input-bg focus:outline-none focus:ring-1 focus:ring-ring/40"
                  />
                  <Button variant="default" size="xs" className="h-6 px-2 text-xs" onClick={submitRename} disabled={!renameValue.trim()} title={tp("rename_tooltip")}>
                    <Check size={12} />
                  </Button>
                  <Button variant="ghost" size="xs" className="h-6 px-1.5 text-muted-foreground" onClick={() => { setIsRenamingProfile(false); setRenameValue(""); }}>
                    <X size={12} />
                  </Button>
                </div>
              )}

              {profileActionError && (
                <p className="text-[10px] text-destructive px-1.5">{profileActionError}</p>
              )}
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {profile.saveStatus === "saving" && (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>{tp("saving")}</span>
                  </>
                )}
                {profile.saveStatus === "saved" && (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span className="text-emerald-500">{tp("saved")}</span>
                  </>
                )}
                {profile.saveStatus === "error" && (
                  <>
                    <CloudOff size={12} className="text-destructive" />
                    <span className="text-destructive">{tp("save_error")}</span>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="xs"
                className={cn(
                  "h-6 px-2 text-xs gap-1 rounded-md transition-all",
                  profile.hasUnsavedChanges
                    ? "text-primary font-semibold"
                    : "text-muted-foreground"
                )}
                onClick={profile.handleSave}
                disabled={!profile.hasUnsavedChanges || profile.saveStatus === "saving"}
              >
                <Save size={12} />
                {tp("save")}
              </Button>
            </div>

            <Tabs value={activeLeftTab} onValueChange={(v) => setActiveLeftTab(v as LeftTab)}>
              <TabsList className="w-full h-10">
                <TabsTrigger value="ai" className="flex-1 gap-1.5">
                  <Sparkles size={14} />
                  {t("tab_ai")}
                </TabsTrigger>
                <TabsTrigger value="cv-builder" className="flex-1 gap-1.5">
                  <PencilRuler size={14} />
                  {t("tab_cv")}
                </TabsTrigger>
                <TabsTrigger value="letter-builder" className="flex-1 gap-1.5">
                  <PenTool size={14} />
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

          <div className="flex-1 overflow-hidden p-5 flex flex-col">
            {activeRightTab === "cv" && (
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
              />
            )}

            {activeRightTab === "letter" && (
              <CoverLetterPreview
                data={profile.coverLetterData || initialCoverLetter}
                personalInfo={profile.currentCV.personalInfo}
                isAdapting={profile.loadingType === "letter"}
              />
            )}

            {activeRightTab === "ats" && (
              <ATSChecker
                cvData={profile.currentCV}
                cvDisplayName={cvDisplayName}
                cvVersionId={currentCvVersionId}
                jobDescription={jobDescription}
                provider={aiConfig.provider}
                model={aiConfig.model}
                apiKey={apiKeys.keys[aiConfig.provider]}
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
