"use client";

import React, { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import CoverLetterTemplate from "./CoverLetterTemplate";
import AIAdaptOverlay from "./AIAdaptOverlay";
import type { CoverLetterData, PersonalInfo } from "@/types/cv";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

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
  const t = useTranslations("LetterPreview");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  // true côté client uniquement (les viewers PDF ne supportent pas le SSR)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Document mémoïsé : un élément stable évite que react-pdf régénère le PDF
  // à chaque render du parent (source de freezes).
  const letterDoc = useMemo(
    () => <CoverLetterTemplate data={data} personalInfo={personalInfo} />,
    [data, personalInfo]
  );

  // Génération à la demande (au clic) au lieu d'un PDFDownloadLink qui
  // re-générait le document en continu.
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(false);
    try {
      const blob = await pdf(<CoverLetterTemplate data={data} personalInfo={personalInfo} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lettre_de_motivation_${personalInfo.role.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }, [data, personalInfo]);

  return (
    <div className="flex flex-col flex-1 h-full w-full gap-3">
      {/* Toolbar */}
      <div className="flex justify-end items-center gap-2">
        {downloadError && (
          <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
            <AlertTriangle size={13} />
            {t("download_error")}
          </div>
        )}
        <Button onClick={handleDownload} disabled={isDownloading} className="gap-1.5">
          {isDownloading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              {t("downloading")}
            </>
          ) : (
            <>
              <Download size={15} />
              {t("download")}
            </>
          )}
        </Button>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm relative">
        <div className={cn("w-full h-full transition-all duration-500", isAdapting && "blur-[5px] scale-[0.99] opacity-40 pointer-events-none")}>
          {mounted && (
            <PDFViewer width="100%" height="100%" className="border-none w-full h-full">
              {letterDoc}
            </PDFViewer>
          )}
        </div>
        {isAdapting && <AIAdaptOverlay type="letter" />}
      </div>
    </div>
  );
}
