"use client";

import React, { useState, useSyncExternalStore } from "react";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import CVTemplate from "./CVTemplate";
import CVTemplateChaima from "./CVTemplateChaima";
import CVInteractiveCanvas from "./CVInteractiveCanvas";
import AIAdaptOverlay from "./AIAdaptOverlay";
import type { CVData } from "@/types/cv";
import { Download, Loader2, LayoutPanelLeft, History } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const emptySubscribe = () => () => {};

interface CVVersion {
  id: string;
  name: string;
}

interface CVPreviewProps {
  data: CVData;
  onChange?: (newData: CVData) => void;
  originalData?: CVData | null;
  template: string;
  onTemplateChange: (template: string) => void;
  isAdapting?: boolean;
  /** Adaptations enregistrées du profil sélectionné. */
  versions?: CVVersion[];
  mainProfileId?: string | null;
  currentProfileId?: string | null;
  onVersionChange?: (id: string) => void;
}

export default function CVPreview({
  data,
  onChange,
  originalData,
  template,
  onTemplateChange,
  isAdapting = false,
  versions = [],
  mainProfileId = null,
  currentProfileId = null,
  onVersionChange,
}: CVPreviewProps) {
  const [sideBySide, setSideBySide] = useState(true);
  const [mode, setMode] = useState<"canvas" | "pdf">("canvas");
  // true côté client uniquement (les viewers PDF ne supportent pas le SSR)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  const ActiveTemplate = template === "chaima" ? CVTemplateChaima : CVTemplate;

  const handleCanvasChange = (newData: CVData) => {
    if (onChange) {
      onChange(newData);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 shrink-0 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 flex-wrap">
          {originalData && (
            <Button 
              variant={sideBySide ? "secondary" : "outline"}
              onClick={() => setSideBySide(!sideBySide)}
              className="gap-2 h-9 text-xs"
              size="sm"
            >
              <LayoutPanelLeft size={14} />
              {sideBySide ? "Vue Unique" : "Côte à Côte"}
            </Button>
          )}

          {/* Sélecteur de Mode */}
          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 shrink-0 h-9">
            <Button
              variant={mode === "canvas" ? "secondary" : "ghost"}
              onClick={() => setMode("canvas")}
              className={cn("h-7 px-3 text-[11px] font-semibold rounded-md transition-all", mode === "canvas" ? "bg-card text-foreground shadow-sm animate-none" : "text-muted-foreground hover:text-foreground")}
              size="sm"
            >
              Éditeur Visuel (Canvas)
            </Button>
            <Button
              variant={mode === "pdf" ? "secondary" : "ghost"}
              onClick={() => setMode("pdf")}
              className={cn("h-7 px-3 text-[11px] font-semibold rounded-md transition-all", mode === "pdf" ? "bg-card text-foreground shadow-sm animate-none" : "text-muted-foreground hover:text-foreground")}
              size="sm"
            >
              Aperçu PDF
            </Button>
          </div>

          {/* Sélecteur de version (CV principal / adaptations) */}
          {mainProfileId && onVersionChange && (
            <Select
              value={currentProfileId ?? mainProfileId}
              onValueChange={(id) => id && onVersionChange(id)}
            >
              <SelectTrigger className="h-9 w-[210px] rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors text-xs gap-1.5">
                <History size={13} className="text-primary shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-md rounded-lg p-1">
                <SelectGroup>
                  <SelectItem value={mainProfileId} className="cursor-pointer text-xs">
                    CV principal
                  </SelectItem>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id} className="cursor-pointer text-xs">
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {/* Sélecteur de Template */}
          <div className="flex items-center bg-muted/40 rounded-lg p-0.5 border border-border/40 shrink-0 h-9">
            <Button
              variant={template === "default" ? "secondary" : "ghost"}
              onClick={() => onTemplateChange("default")}
              className={cn("h-7 px-3 text-[11px] font-semibold rounded-md transition-all", template === "default" ? "bg-card text-foreground shadow-sm animate-none" : "text-muted-foreground hover:text-foreground")}
              size="sm"
            >
              Classique
            </Button>
            <Button
              variant={template === "chaima" ? "secondary" : "ghost"}
              onClick={() => onTemplateChange("chaima")}
              className={cn("h-7 px-3 text-[11px] font-semibold rounded-md transition-all", template === "chaima" ? "bg-card text-foreground shadow-sm animate-none" : "text-muted-foreground hover:text-foreground")}
              size="sm"
            >
              Moderne
            </Button>
          </div>
        </div>
        
        {mounted && (
          <PDFDownloadLink
            document={<ActiveTemplate data={data} />}
            fileName={`CV_${data.personalInfo.name.replace(/\s+/g, "_")}_${data.personalInfo.role.replace(/\s+/g, "_")}.pdf`}
            className={cn(buttonVariants({ variant: "default", size: "default" }), "h-9 text-xs")}
          >
            {({ loading }) =>
              loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Download size={14} />
                  Télécharger le PDF
                </>
              )
            }
          </PDFDownloadLink>
        )}
      </div>

      {/* Preview Viewers (Canvas vs PDF) */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
        <div className={cn("flex-1 flex flex-col overflow-hidden min-h-0 transition-all duration-500", isAdapting && "blur-[5px] scale-[0.99] opacity-40 pointer-events-none")}>
          {mounted && mode === "canvas" && (
            <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
              {originalData && sideBySide ? (
                <>
                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    <div className="text-sm font-medium text-muted-foreground text-center">
                      CV Original
                    </div>
                    <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0">
                      <PDFViewer
                        key={`orig-${template}`}
                        width="100%"
                        height="100%"
                        showToolbar={false}
                        className="border-none w-full h-full"
                      >
                        <ActiveTemplate data={originalData} />
                      </PDFViewer>
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    <div className="text-sm font-medium text-success text-center shrink-0">
                      CV Adapté (Édition Visuelle)
                    </div>
                    <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0 flex flex-col">
                      <CVInteractiveCanvas
                        data={data}
                        onChange={handleCanvasChange}
                        template={template}
                        originalData={originalData}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0 flex flex-col">
                  <CVInteractiveCanvas
                    data={data}
                    onChange={handleCanvasChange}
                    template={template}
                    originalData={originalData}
                  />
                </div>
              )}
            </div>
          )}

          {mounted && mode === "pdf" && (
            <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
              {originalData && sideBySide && (
                <div className="flex-1 flex flex-col gap-2 min-h-0">
                  <div className="text-sm font-medium text-muted-foreground text-center">
                    CV Original
                  </div>
                  <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0">
                    <PDFViewer
                      key={`orig-${template}`}
                      width="100%"
                      height="100%"
                      showToolbar={false}
                      className="border-none w-full h-full"
                    >
                      <ActiveTemplate data={originalData} />
                    </PDFViewer>
                  </div>
                </div>
              )}
              
              <div className="flex-1 flex flex-col gap-2 min-h-0">
                {originalData && sideBySide && (
                  <div className="text-sm font-medium text-success text-center">
                    CV Adapté (Modifications surlignées)
                  </div>
                )}
                <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0">
                  <PDFViewer
                    key={`adap-${template}-${data.experiences.map((e) => e.id).join(",")}-${data.projects.map((p) => p.id).join(",")}-${data.skills.map((s) => s.id).join(",")}-${data.education.map((e) => e.id).join(",")}-${data.spokenLanguages.join(",")}-${JSON.stringify(data.layout)}`}
                    width="100%"
                    height="100%"
                    showToolbar={false}
                    className="border-none w-full h-full"
                  >
                    <ActiveTemplate data={data} originalData={(sideBySide && originalData) ? originalData : undefined} />
                  </PDFViewer>
                </div>
              </div>
            </div>
          )}
        </div>
        {isAdapting && <AIAdaptOverlay type="cv" />}
      </div>
    </div>
  );
}
