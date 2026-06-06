"use client";

import React, { useState, useEffect } from "react";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import CoverLetterTemplate from "./CoverLetterTemplate";
import AIAdaptOverlay from "./AIAdaptOverlay";
import type { CoverLetterData, PersonalInfo } from "@/types/cv";
import { Download, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CoverLetterPreviewProps {
  data: CoverLetterData;
  personalInfo: PersonalInfo;
  isAdapting?: boolean;
}

export default function CoverLetterPreview({ 
  data, 
  personalInfo,
  isAdapting = false,
}: CoverLetterPreviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="flex flex-col flex-1 h-full w-full gap-3">
      {/* Toolbar */}
      <div className="flex justify-end items-center">
        <PDFDownloadLink
          document={<CoverLetterTemplate data={data} personalInfo={personalInfo} />}
          fileName={`Lettre_de_motivation_${personalInfo.role.replace(/\s+/g, "_")}.pdf`}
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

      {/* PDF Viewer */}
      <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm relative">
        <div className={cn("w-full h-full transition-all duration-500", isAdapting && "blur-[5px] scale-[0.99] opacity-40 pointer-events-none")}>
          {mounted && (
            <PDFViewer width="100%" height="100%" className="border-none w-full h-full">
              <CoverLetterTemplate data={data} personalInfo={personalInfo} />
            </PDFViewer>
          )}
        </div>
        {isAdapting && <AIAdaptOverlay type="letter" />}
      </div>
    </div>
  );
}
