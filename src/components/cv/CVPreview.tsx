"use client";

import React, { useState, useEffect } from "react";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import CVTemplate from "./CVTemplate";
import type { CVData } from "@/types/cv";
import { Download, Loader2, LayoutPanelLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CVPreviewProps {
  data: CVData;
  originalData?: CVData | null;
}

export default function CVPreview({ data, originalData }: CVPreviewProps) {
  const [sideBySide, setSideBySide] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col flex-1 h-full w-full gap-3">
      {/* Toolbar */}
      <div className={cn("flex items-center", originalData ? "justify-between" : "justify-end")}>
        {originalData && (
          <Button 
            variant={sideBySide ? "secondary" : "outline"}
            onClick={() => setSideBySide(!sideBySide)}
            className="gap-2"
          >
            <LayoutPanelLeft size={15} />
            {sideBySide ? "Vue Unique" : "Côte à Côte"}
          </Button>
        )}
        
        <PDFDownloadLink
          document={<CVTemplate data={data} />}
          fileName={`CV_${data.personalInfo.name.replace(/\s+/g, "_")}_${data.personalInfo.role.replace(/\s+/g, "_")}.pdf`}
          className={cn(buttonVariants({ variant: "default", size: "default" }))}
        >
          {({ loading }) =>
            loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Génération...
              </>
            ) : (
              <>
                <Download size={15} />
                Télécharger le PDF
              </>
            )
          }
        </PDFDownloadLink>
      </div>

      {/* PDF Viewers */}
      <div className="flex-1 flex gap-5 overflow-hidden">
        {mounted && originalData && sideBySide && (
          <div className="flex-1 flex flex-col gap-2">
            <div className="text-sm font-medium text-muted-foreground text-center">
              CV Original
            </div>
            <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm">
              <PDFViewer
                width="100%"
                height="100%"
                showToolbar={false}
                className="border-none w-full h-full"
              >
                <CVTemplate data={originalData} />
              </PDFViewer>
            </div>
          </div>
        )}
        
        <div className="flex-1 flex flex-col gap-2">
          {originalData && sideBySide && (
            <div className="text-sm font-medium text-success text-center">
              CV Adapté (Modifications surlignées)
            </div>
          )}
          <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm">
            {mounted && (
              <PDFViewer
                key={`${data.experiences.map((e) => e.id).join(",")}-${data.projects.map((p) => p.id).join(",")}-${data.skills.map((s) => s.id).join(",")}-${data.education.map((e) => e.id).join(",")}-${data.spokenLanguages.join(",")}-${JSON.stringify(data.layout)}`}
                width="100%"
                height="100%"
                showToolbar={false}
                className="border-none w-full h-full"
              >
                <CVTemplate data={data} originalData={(sideBySide && originalData) ? originalData : undefined} />
              </PDFViewer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
