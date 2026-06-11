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
  Wand2,
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
} from "lucide-react";

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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useProfileManager } from "@/hooks/use-profile-manager";
import { useAIProviderConfig, PROVIDER_MODELS } from "@/hooks/use-ai-provider-config";
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
type RightTab = "cv" | "letter";

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
  const locale = useLocale();

  const [activeLeftTab, setActiveLeftTab] = useState<LeftTab>("ai");
  const [activeRightTab, setActiveRightTab] = useState<RightTab>("cv");
  const [jobDescription, setJobDescription] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const profile = useProfileManager(locale, t);
  const aiConfig = useAIProviderConfig();

  const { handleAdaptCV, handleGenerateLetter } = useAISubmission({
    jobDescription,
    provider: aiConfig.provider,
    model: aiConfig.model,
    currentCV: profile.currentCV,
    locale,
    selectedProfile: profile.selectedProfile,
    getInitialCV: profile.getInitialCV,
    getProviderName: aiConfig.getProviderName,
    applyAdaptation: profile.applyAdaptation,
    setCoverLetterData: profile.setCoverLetterData,
    setActiveRightTab,
    setStatus: profile.setStatus,
    setStatusMessage: profile.setStatusMessage,
    setStatusDetails: profile.setStatusDetails,
    setLoadingType: profile.setLoadingType,
    t,
  });

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

            <div className="flex gap-2">
              <Button
                variant={aiConfig.provider === "gemini" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => aiConfig.handleProviderChange("gemini")}
                disabled={profile.status === "loading"}
              >
                {t("btn_gemini")}
              </Button>
              <Button
                variant={aiConfig.provider === "groq" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => aiConfig.handleProviderChange("groq")}
                disabled={profile.status === "loading"}
              >
                {t("btn_groq")}
              </Button>
              <Button
                variant={aiConfig.provider === "mistral" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => aiConfig.handleProviderChange("mistral")}
                disabled={profile.status === "loading"}
              >
                {t("btn_mistral")}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
                {t("label_model")}
              </span>
              <Select value={aiConfig.model} onValueChange={(val) => val && aiConfig.setModel(val)} disabled={profile.status === "loading"}>
                <SelectTrigger className="w-full h-9 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-md rounded-lg p-1">
                  <SelectGroup>
                    {PROVIDER_MODELS[aiConfig.provider].map((m) => (
                      <SelectItem key={m.id} value={m.id} className="cursor-pointer">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleAdaptCV}
                disabled={profile.status === "loading" || !jobDescription.trim()}
                className="gap-2"
              >
                {profile.status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {t("btn_adapt")}
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
                onClick={handleGenerateLetter}
                disabled={profile.status === "loading" || !jobDescription.trim()}
              >
                <Mail size={16} />
                {t("btn_letter")}
              </Button>
            </div>

            {(profile.isAdapted || profile.coverLetterData) && profile.status !== "loading" && (
              <Button variant="ghost" onClick={profile.handleReset} className="text-muted-foreground gap-1.5" size="sm">
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

      <SidebarProvider
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        style={{ "--sidebar-width": "480px" } as React.CSSProperties}
        className="flex-1 flex overflow-hidden w-full !min-h-0 !h-full"
      >
        <Sidebar side="left" variant="sidebar" className="border-r border-border !top-14 !h-[calc(100svh-3.5rem)]">
          <SidebarHeader className="px-3 pt-3 pb-2 border-b border-border shrink-0 bg-sidebar flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1 bg-muted/40 rounded-lg p-1 border border-border/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-1.5">Profil actif :</span>
              <div className="flex gap-1">
                {(profile.profiles.length > 0
                  ? [...new Map(profile.profiles.map((p) => [p.slug, p])).values()]
                  : [{ slug: "omar", name: "Omar" }, { slug: "chaima", name: "Chaima" }]
                ).map((p) => (
                  <Button
                    key={p.slug}
                    variant={profile.selectedProfile === p.slug ? "default" : "ghost"}
                    size="xs"
                    className={cn("h-6 px-3 text-xs font-semibold rounded-md transition-all", profile.selectedProfile === p.slug ? "shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    onClick={() => profile.handleProfileChange(p.slug)}
                  >
                    {p.name.split(" ")[0]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {profile.saveStatus === "saving" && (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Sauvegarde...</span>
                  </>
                )}
                {profile.saveStatus === "saved" && (
                  <>
                    <Check size={12} className="text-emerald-500" />
                    <span className="text-emerald-500">Sauvegardé</span>
                  </>
                )}
                {profile.saveStatus === "error" && (
                  <>
                    <CloudOff size={12} className="text-destructive" />
                    <span className="text-destructive">Erreur</span>
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
                Save
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
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
            </Button>

            <Tabs value={activeRightTab} onValueChange={(v) => setActiveRightTab(v as RightTab)}>
              <TabsList className="w-[320px]">
                <TabsTrigger value="cv" className="flex-1 gap-1.5">
                  <FileText size={14} />
                  {tr("tab_cv")}
                </TabsTrigger>
                <TabsTrigger value="letter" className="flex-1 gap-1.5">
                  <Mail size={14} />
                  {tr("tab_letter")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-hidden p-5 flex flex-col">
            {activeRightTab === "cv" ? (
              <CVPreview
                data={profile.currentCV}
                onChange={profile.setCurrentCV}
                originalData={profile.isAdapted ? profile.originalCV : null}
                template={profile.selectedTemplate}
                onTemplateChange={profile.setSelectedTemplate}
                isAdapting={profile.loadingType === "cv"}
                versions={profile.versions}
                mainProfileId={profile.mainProfileId}
                currentProfileId={profile.currentProfileId}
                onVersionChange={profile.selectVersion}
              />
            ) : (
              <CoverLetterPreview
                data={profile.coverLetterData || initialCoverLetter}
                personalInfo={profile.currentCV.personalInfo}
                isAdapting={profile.loadingType === "letter"}
              />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
