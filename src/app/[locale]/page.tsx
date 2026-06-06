"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import cvDataEnRaw from "@/data/cv_data_en.json";
import cvDataFrRaw from "@/data/cv_data_fr.json";
import cvDataChaimaEnRaw from "@/data/cv_data_chaima_en.json";
import cvDataChaimaFrRaw from "@/data/cv_data_chaima_fr.json";
import type { CVData, AIProvider, CoverLetterData } from "@/types/cv";
import { v4 as uuidv4 } from "uuid";
import CVBuilder from "@/components/cv/CVBuilder";
import CoverLetterBuilder from "@/components/cv/CoverLetterBuilder";
import { defaultLayout } from "@/lib/cv-layout";
import { useTranslations, useLocale } from "next-intl";
import Header from "@/components/Header";
import {
  Sparkles,
  PencilRuler,
  Wand2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Mail,
  PenTool,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarRail, SidebarInset } from "@/components/ui/sidebar";

// Dynamic imports with SSR disabled
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

type Status = "idle" | "loading" | "success" | "error";
type LeftTab = "ai" | "cv-builder" | "letter-builder";
type RightTab = "cv" | "letter";

const injectIds = (data: any): CVData => ({
  ...data,
  skills: data.skills.map((s: any) => ({ ...s, id: s.id || uuidv4() })),
  experiences: data.experiences.map((e: any) => ({ ...e, id: e.id || uuidv4() })),
  projects: (data.projects || []).map((p: any) => ({ ...p, id: p.id || uuidv4() })),
  education: data.education.map((ed: any) => ({ ...ed, id: ed.id || uuidv4() })),
  layout: data.layout ?? defaultLayout(),
});

const initialDataEn = injectIds(cvDataEnRaw);
const initialDataFr = injectIds(cvDataFrRaw);
const initialDataChaimaEn = injectIds(cvDataChaimaEnRaw);
const initialDataChaimaFr = injectIds(cvDataChaimaFrRaw);

function detectLanguage(text: string): "fr" | "en" {
  const frenchWords = [" de ", " la ", " le ", " et ", " pour ", " dans ", " en ", " une ", " des ", " est ", " avec ", " plus ", " sur ", " par "];
  const englishWords = [" of ", " the ", " and ", " for ", " in ", " a ", " with ", " is ", " to ", " on ", " at ", " more ", " by "];
  
  let frCount = 0;
  let enCount = 0;
  
  const lowerText = text.toLowerCase();
  for (const word of frenchWords) {
    let pos = 0;
    while ((pos = lowerText.indexOf(word, pos)) !== -1) {
      frCount++;
      pos += word.length;
    }
  }
  for (const word of englishWords) {
    let pos = 0;
    while ((pos = lowerText.indexOf(word, pos)) !== -1) {
      enCount++;
      pos += word.length;
    }
  }
  
  return frCount >= enCount ? "fr" : "en";
}

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
  
  const [selectedProfile, setSelectedProfile] = useState<"omar" | "chaima">("omar");
  const [selectedTemplate, setSelectedTemplate] = useState<"default" | "chaima">("default");
  
  const [jobDescription, setJobDescription] = useState("");
  const [provider, setProvider] = useState<AIProvider>("gemini");

  const getInitialCV = useCallback((profile: "omar" | "chaima", lang: string) => {
    if (profile === "omar") {
      return lang === "fr" ? initialDataFr : initialDataEn;
    } else {
      return lang === "fr" ? initialDataChaimaFr : initialDataChaimaEn;
    }
  }, []);
  
  const [currentCV, setCurrentCV] = useState<CVData>(() => getInitialCV("omar", locale));
  const [originalCV, setOriginalCV] = useState<CVData | null>(null);
  const [isAdapted, setIsAdapted] = useState(false);
  
  const [coverLetterData, setCoverLetterData] = useState<CoverLetterData | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const pending = sessionStorage.getItem("pending_adapted_cv");
    if (pending) {
      try {
        const { adaptedCV, originalCV, jobDescription: savedJobDesc, profile } = JSON.parse(pending);
        setCurrentCV(adaptedCV);
        setOriginalCV(originalCV);
        setIsAdapted(true);
        setJobDescription(savedJobDesc);
        setSelectedProfile(profile);
        setSelectedTemplate(profile === "omar" ? "default" : "chaima");
        setActiveRightTab("cv");
        setStatus("success");
        setStatusMessage(t("status_success_cv", { provider: "Gemini" }));
      } catch (e) {
        console.error("Failed to parse pending adapted CV", e);
      } finally {
        sessionStorage.removeItem("pending_adapted_cv");
      }
      return;
    }

    const data = getInitialCV(selectedProfile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setStatus("idle");
    setStatusMessage("");
  }, [selectedProfile, locale, getInitialCV, t]);

  const handleAdaptCV = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      return;
    }
    setStatus("loading");
    setStatusMessage(t("status_loading_cv"));

    const jobLang = detectLanguage(jobDescription);
    const hasLangMismatch = jobLang !== locale;

    let sourceCV = currentCV;
    let originalSourceCV = currentCV;

    if (hasLangMismatch) {
      sourceCV = getInitialCV(selectedProfile, jobLang);
      originalSourceCV = sourceCV;
    } else {
      setOriginalCV(currentCV);
    }

    try {
      const res = await fetch("/api/adapt-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: sourceCV, provider }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || `Error ${res.status}`); }
      const data = await res.json();

      if (hasLangMismatch) {
        sessionStorage.setItem("pending_adapted_cv", JSON.stringify({
          adaptedCV: data.adaptedCV,
          originalCV: originalSourceCV,
          jobDescription: jobDescription.trim(),
          profile: selectedProfile,
        }));
        window.location.href = `/${jobLang}`;
      } else {
        setCurrentCV(data.adaptedCV);
        setIsAdapted(true);
        setActiveRightTab("cv");
        setStatus("success");
        setStatusMessage(t("status_success_cv", { provider: data.provider === "gemini" ? "Gemini" : "Groq" }));
      }
    } catch (err) {
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : t("status_error"));
    }
  }, [jobDescription, provider, currentCV, locale, selectedProfile, getInitialCV, t]);

  const handleGenerateLetter = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      return;
    }
    setStatus("loading");
    setStatusMessage(t("status_loading_letter"));
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: currentCV, provider }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || `Error ${res.status}`); }
      const data = await res.json();
      setCoverLetterData(data.coverLetter);
      setActiveRightTab("letter");
      setStatus("success");
      setStatusMessage(t("status_success_letter", { provider: data.provider === "gemini" ? "Gemini" : "Groq" }));
    } catch (err) {
      setStatus("error");
      setStatusMessage(err instanceof Error ? err.message : t("status_error"));
    }
  }, [jobDescription, provider, currentCV, t]);

  const handleProfileChange = useCallback((profile: "omar" | "chaima") => {
    setSelectedProfile(profile);
    const data = getInitialCV(profile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setCoverLetterData(null);
    setStatus("idle");
    setStatusMessage("");
    setSelectedTemplate(profile === "omar" ? "default" : "chaima");
  }, [locale, getInitialCV]);

  const handleReset = useCallback(() => {
    const data = getInitialCV(selectedProfile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setCoverLetterData(null);
    setStatus("idle");
    setStatusMessage("");
  }, [selectedProfile, locale, getInitialCV]);

  // ─── Render the left panel content based on active tab ───
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
              disabled={status === "loading"}
            />

            <div className="flex gap-2">
              <Button
                variant={provider === "gemini" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setProvider("gemini")}
                disabled={status === "loading"}
              >
                {t("btn_gemini")}
              </Button>
              <Button
                variant={provider === "groq" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setProvider("groq")}
                disabled={status === "loading"}
              >
                {t("btn_groq")}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleAdaptCV}
                disabled={status === "loading" || !jobDescription.trim()}
                className="gap-2"
              >
                {status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {t("btn_adapt")}
              </Button>
              <Button
                variant="outline"
                className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
                onClick={handleGenerateLetter}
                disabled={status === "loading" || !jobDescription.trim()}
              >
                <Mail size={16} />
                {t("btn_letter")}
              </Button>
            </div>

            {(isAdapted || coverLetterData) && status !== "loading" && (
              <Button variant="ghost" onClick={handleReset} className="text-muted-foreground gap-1.5" size="sm">
                <RotateCcw size={14} />
                {t("btn_reset")}
              </Button>
            )}

            {status !== "idle" && statusMessage && (
              <div className={`flex items-center gap-3 p-3 rounded-lg text-sm font-medium border ${
                status === "loading" ? "bg-primary/5 border-primary/15 text-primary"
                : status === "success" ? "bg-success/10 border-success/20 text-success"
                : "bg-destructive/5 border-destructive/20 text-destructive"
              }`}>
                {status === "loading" && <Loader2 size={15} className="animate-spin shrink-0" />}
                {status === "success" && <CheckCircle2 size={15} className="shrink-0" />}
                {status === "error" && <AlertCircle size={15} className="shrink-0" />}
                <span>{statusMessage}</span>
              </div>
            )}
          </div>
        );
      case "cv-builder":
        return (
          <div className="p-6">
            <CVBuilder data={currentCV} onChange={setCurrentCV} />
          </div>
        );
      case "letter-builder":
        return (
          <div className="p-6">
            <CoverLetterBuilder
              data={coverLetterData || initialCoverLetter}
              onChange={(newData) => {
                setCoverLetterData(newData);
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
        {/* ── Left Panel ── */}
        <Sidebar side="left" variant="sidebar" className="border-r border-border !top-14 !h-[calc(100svh-3.5rem)]">
          <SidebarHeader className="px-3 pt-3 pb-2 border-b border-border shrink-0 bg-sidebar flex flex-col gap-2.5">
            {/* Profil switcher */}
            <div className="flex items-center justify-between px-1 bg-muted/40 rounded-lg p-1 border border-border/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-1.5">Profil actif :</span>
              <div className="flex gap-1">
                <Button
                  variant={selectedProfile === "omar" ? "default" : "ghost"}
                  size="xs"
                  className={cn("h-6 px-3 text-xs font-semibold rounded-md transition-all", selectedProfile === "omar" ? "shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => handleProfileChange("omar")}
                >
                  Omar
                </Button>
                <Button
                  variant={selectedProfile === "chaima" ? "default" : "ghost"}
                  size="xs"
                  className={cn("h-6 px-3 text-xs font-semibold rounded-md transition-all", selectedProfile === "chaima" ? "shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => handleProfileChange("chaima")}
                >
                  Chaima
                </Button>
              </div>
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
          {/* Preview tab selector */}
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

            {/* Preview content */}
            <div className="flex-1 overflow-hidden p-5 flex flex-col">
              {activeRightTab === "cv" ? (
                <CVPreview
                  data={currentCV}
                  onChange={setCurrentCV}
                  originalData={isAdapted ? originalCV : null}
                  template={selectedTemplate}
                  onTemplateChange={setSelectedTemplate}
                />
              ) : (
                <CoverLetterPreview
                  data={coverLetterData || initialCoverLetter}
                  personalInfo={currentCV.personalInfo}
                />
              )}
            </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
