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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const PROVIDER_MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
    { id: "llama3-70b-8192", name: "Llama 3 70B" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
  mistral: [
    { id: "mistral-large-2512", name: "Mistral Large" },
    { id: "mistral-small-2603", name: "Mistral Small" },
    { id: "ministral-8b-2512", name: "Ministral 8B" },
  ],
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
  const [model, setModel] = useState<string>("gemini-2.5-flash");

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
  const [statusDetails, setStatusDetails] = useState<string | string[] | null>(null);
  const [loadingType, setLoadingType] = useState<"cv" | "letter" | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleProviderChange = useCallback((newProvider: AIProvider) => {
    setProvider(newProvider);
    if (newProvider === "gemini") {
      setModel("gemini-2.5-flash");
    } else if (newProvider === "groq") {
      setModel("llama-3.3-70b-versatile");
    } else if (newProvider === "mistral") {
      setModel("mistral-large-2512");
    }
  }, []);

  const getProviderName = useCallback((p: AIProvider) => {
    if (p === "gemini") return "Gemini";
    if (p === "groq") return "Groq";
    return "Mistral";
  }, []);

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
        setStatusDetails(null);
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
    setStatusDetails(null);
  }, [selectedProfile, locale, getInitialCV, t]);

  const handleAdaptCV = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      setStatusDetails(null);
      return;
    }
    setStatus("loading");
    setLoadingType("cv");
    setActiveRightTab("cv");
    setStatusMessage(t("status_loading_cv"));
    setStatusDetails(null);

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
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: sourceCV, provider, model }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
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
        setStatusMessage(t("status_success_cv", { provider: getProviderName(data.provider) }));
      }
    } catch (err: any) {
      setStatus("error");
      const msg = err.error || err.message || t("status_error");
      const details = err.details || null;
      setStatusMessage(msg);
      setStatusDetails(details);
    } finally {
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, currentCV, locale, selectedProfile, getInitialCV, t, setActiveRightTab, getProviderName]);

  const handleGenerateLetter = useCallback(async () => {
    if (!jobDescription.trim() || jobDescription.trim().length < 20) {
      setStatus("error");
      setStatusMessage(t("error_empty"));
      setStatusDetails(null);
      return;
    }
    setStatus("loading");
    setLoadingType("letter");
    setActiveRightTab("letter");
    setStatusMessage(t("status_loading_letter"));
    setStatusDetails(null);
    try {
      const res = await fetch("/api/generate-cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim(), cvData: currentCV, provider, model }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw errData;
      }
      const data = await res.json();
      setCoverLetterData(data.coverLetter);
      setActiveRightTab("letter");
      setStatus("success");
      setStatusMessage(t("status_success_letter", { provider: getProviderName(data.provider) }));
    } catch (err: any) {
      setStatus("error");
      const msg = err.error || err.message || t("status_error");
      const details = err.details || null;
      setStatusMessage(msg);
      setStatusDetails(details);
    } finally {
      setLoadingType(null);
    }
  }, [jobDescription, provider, model, currentCV, t, setActiveRightTab, getProviderName]);

  const handleProfileChange = useCallback((profile: "omar" | "chaima") => {
    setSelectedProfile(profile);
    const data = getInitialCV(profile, locale);
    setCurrentCV(data);
    setOriginalCV(null);
    setIsAdapted(false);
    setCoverLetterData(null);
    setStatus("idle");
    setStatusMessage("");
    setStatusDetails(null);
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
    setStatusDetails(null);
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
                onClick={() => handleProviderChange("gemini")}
                disabled={status === "loading"}
              >
                {t("btn_gemini")}
              </Button>
              <Button
                variant={provider === "groq" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleProviderChange("groq")}
                disabled={status === "loading"}
              >
                {t("btn_groq")}
              </Button>
              <Button
                variant={provider === "mistral" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => handleProviderChange("mistral")}
                disabled={status === "loading"}
              >
                {t("btn_mistral")}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground pl-0.5">
                {t("label_model")}
              </span>
              <Select value={model} onValueChange={(val) => val && setModel(val)} disabled={status === "loading"}>
                <SelectTrigger className="w-full h-9 rounded-lg border border-border bg-muted/40 hover:bg-muted/60 transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-md rounded-lg p-1">
                  <SelectGroup>
                    {PROVIDER_MODELS[provider].map((m) => (
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
              <div className={`flex flex-col gap-2 p-3 rounded-lg text-sm border animate-in fade-in slide-in-from-top-1 duration-200 ${
                status === "loading" ? "bg-primary/5 border-primary/15 text-primary"
                : status === "success" ? "bg-success/10 border-success/20 text-success"
                : "bg-destructive/5 border-destructive/20 text-destructive"
              }`}>
                <div className="flex items-center gap-3 font-medium">
                  {status === "loading" && <Loader2 size={15} className="animate-spin shrink-0" />}
                  {status === "success" && <CheckCircle2 size={15} className="shrink-0" />}
                  {status === "error" && <AlertCircle size={15} className="shrink-0" />}
                  <span>{statusMessage}</span>
                </div>
                {status === "error" && statusDetails && (
                  <div className="pl-6 text-xs text-destructive/80 leading-relaxed border-t border-destructive/10 pt-1.5 mt-0.5 animate-in fade-in duration-300">
                    {Array.isArray(statusDetails) ? (
                      <ul className="list-disc pl-4 flex flex-col gap-1">
                        {statusDetails.map((detail, idx) => (
                          <li key={idx}>{detail}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{statusDetails}</p>
                    )}
                  </div>
                )}
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
                  isAdapting={loadingType === "cv"}
                />
              ) : (
                <CoverLetterPreview
                  data={coverLetterData || initialCoverLetter}
                  personalInfo={currentCV.personalInfo}
                  isAdapting={loadingType === "letter"}
                />
              )}
            </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
