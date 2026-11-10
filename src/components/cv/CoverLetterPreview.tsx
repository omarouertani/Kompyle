"use client";

import React, { useState, useMemo, useCallback, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import CoverLetterTemplate, { type CoverLetterLabels } from "./CoverLetterTemplate";
import AIProgressOverlay from "./AIProgressOverlay";
import type { CoverLetterData, CVTheme, PersonalInfo } from "@/types/cv";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeFileName } from "@/utils/strip-html";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const emptySubscribe = () => () => {};

interface CoverLetterPreviewProps {
  data: CoverLetterData;
  personalInfo: PersonalInfo;
  isAdapting?: boolean;
  /** Theme of the current CV (font, colours): the letter matches it. */
  theme?: CVTheme;
}

export default function CoverLetterPreview({
  data,
  personalInfo,
  isAdapting = false,
  theme,
}: CoverLetterPreviewProps) {
  const t = useTranslations("LetterPreview");
  const tAdapt = useTranslations("AIAdapt");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  // true côté client uniquement (les viewers PDF ne supportent pas le SSR)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Document mémoïsé : un élément stable évite que react-pdf régénère le PDF
  // à chaque render du parent (source de freezes).
  const labels = useMemo<CoverLetterLabels>(
    () => ({ subjectPrefix: t("subject_prefix"), documentTitle: t("document_title") }),
    [t]
  );
  // The on-screen preview re-renders the whole PDF: wait for a pause in
  // typing (600 ms) instead of regenerating on every keystroke. The download
  // below uses the live values.
  const previewData = useDebouncedValue(data);
  const previewInfo = useDebouncedValue(personalInfo);
  const previewTheme = useDebouncedValue(theme);
  const letterDoc = useMemo(
    () => <CoverLetterTemplate data={previewData} personalInfo={previewInfo} labels={labels} theme={previewTheme} />,
    [previewData, previewInfo, labels, previewTheme]
  );

  // Génération à la demande (au clic) au lieu d'un PDFDownloadLink qui
  // re-générait le document en continu.
  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(false);
    try {
      const blob = await pdf(<CoverLetterTemplate data={data} personalInfo={personalInfo} labels={labels} theme={theme} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName([t("file_prefix"), personalInfo.role])}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }, [data, personalInfo, labels, theme, t]);

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
        <AIProgressOverlay active={isAdapting} title={tAdapt("adapting_letter")} />
      </div>
    </div>
  );
}
