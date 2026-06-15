"use client";

import React, { useState, useCallback, useSyncExternalStore, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import CVInteractiveCanvas from "./CVInteractiveCanvas";
import AIAdaptOverlay from "./AIAdaptOverlay";
import type { CVData } from "@/types/cv";
import { normalizeTemplate } from "@/lib/cv-layout";
import { Download, Loader2, LayoutPanelLeft, History, AlertTriangle, LayoutTemplate, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  versions?: CVVersion[];
  mainProfileId?: string | null;
  currentProfileId?: string | null;
  onVersionChange?: (id: string) => void;
  onDeleteVersion?: (id: string) => void | Promise<void | boolean>;
  /** Ouvre le panneau ATS Checker sur le CV actuellement sélectionné. */
  onOpenATS?: () => void;
  /** Si true, applique l'effet diamant au bouton ATS pour attirer l'œil
   *  (jamais audité pour cette version de CV). */
  atsButtonShine?: boolean;
}

/**
 * Fetches a PDF from the server-side render API. All heavy rendering happens
 * on the server — the browser thread stays free. Debounces by 600ms.
 */
function useServerPdfUrl(
  data: CVData | null,
  template: string,
  enabled: boolean,
  originalData?: CVData | null,
  sideBySide?: boolean
): { url: string | null; loading: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const prevUrlRef = useRef<string | null>(null);
  const dataRef = useRef({ data, template, originalData, sideBySide });
  dataRef.current = { data, template, originalData, sideBySide };

  useEffect(() => {
    if (!enabled || !data) {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
        prevUrlRef.current = null;
      }
      setUrl(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        const { data: d, template: t, originalData: od, sideBySide: sbs } = dataRef.current;
        const res = await fetch("/api/render-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: d, template: t, originalData: od, sideBySide: sbs }),
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
        const newUrl = URL.createObjectURL(blob);
        prevUrlRef.current = newUrl;
        setUrl(newUrl);
      } catch (err) {
        console.error("Server PDF generation failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, data, template, originalData, sideBySide]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  return { url, loading };
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
  onDeleteVersion,
  onOpenATS,
  atsButtonShine = false,
}: CVPreviewProps) {
  const t = useTranslations("CVPreview");
  const [sideBySide, setSideBySide] = useState(false);
  const [mode, setMode] = useState<"canvas" | "pdf">("canvas");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Le CV affiché est-il une adaptation supprimable (≠ CV principal) ?
  const selectedVersionId = currentProfileId ?? mainProfileId;
  const isAdaptedVersion = !!currentProfileId && currentProfileId !== mainProfileId;
  const selectedVersionName = versions.find((v) => v.id === currentProfileId)?.name ?? "";

  // Template normalisé : les anciennes lignes "chaima" → "modern".
  const tpl = normalizeTemplate(template);
  const TEMPLATE_OPTIONS = [
    { id: "default", label: t("template_default") },
    { id: "modern", label: t("template_modern") },
    { id: "canadian", label: t("template_canadian") },
  ];

  const handleCanvasChange = (newData: CVData) => {
    if (onChange) onChange(newData);
  };

  // Server-side PDF generation — disabled when content overflows the A4 page
  const isPdf = mode === "pdf";
  const needsOriginalPdf = sideBySide && !!originalData;

  const { url: originalUrl, loading: originalLoading } = useServerPdfUrl(
    originalData ?? null, template, needsOriginalPdf && !isOverflowing
  );
  const { url: adaptedUrl, loading: adaptedLoading } = useServerPdfUrl(
    data, template, isPdf && !isOverflowing, originalData, sideBySide
  );

  const handleDownload = useCallback(async () => {
    if (isOverflowing) return;
    setIsDownloading(true);
    setDownloadError(false);
    try {
      const res = await fetch("/api/render-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, template }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CV_${data.personalInfo.name.replace(/\s+/g, "_")}_${data.personalInfo.role.replace(/\s+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      setDownloadError(true);
    } finally {
      setIsDownloading(false);
    }
  }, [data, template, isOverflowing]);

  return (
    <div className="flex flex-col flex-1 h-full w-full gap-3">
      {/* Confirmation de suppression d'un CV adapté (thème de l'app) */}
      <ConfirmDialog
        open={confirmDeleteVersion}
        onOpenChange={setConfirmDeleteVersion}
        destructive
        title={t("delete_version_title")}
        description={t("delete_version_desc", { name: selectedVersionName })}
        cancelLabel={t("cancel")}
        confirmLabel={t("delete")}
        onConfirm={() => {
          setConfirmDeleteVersion(false);
          if (currentProfileId && onDeleteVersion) onDeleteVersion(currentProfileId);
        }}
      />

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
              {sideBySide ? t("view_single") : t("view_side")}
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
              {t("mode_canvas")}
            </Button>
            <Button
              variant={mode === "pdf" ? "secondary" : "ghost"}
              onClick={() => setMode("pdf")}
              className={cn("h-7 px-3 text-[11px] font-semibold rounded-md transition-all", mode === "pdf" ? "bg-card text-foreground shadow-sm animate-none" : "text-muted-foreground hover:text-foreground")}
              size="sm"
            >
              {t("mode_pdf")}
            </Button>
          </div>

          {/* Sélecteur de version + suppression du CV adapté courant */}
          {mainProfileId && onVersionChange && (
            <div className="flex items-center gap-1">
              <Select
                value={selectedVersionId ?? undefined}
                onValueChange={(id) => id && onVersionChange(id)}
              >
                <SelectTrigger className="h-9 w-[210px] rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors text-xs gap-1.5">
                  <History size={13} className="text-primary shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-md rounded-lg p-1">
                  <SelectGroup>
                    <SelectItem value={mainProfileId} className="cursor-pointer text-xs">
                      {t("version_main")}
                    </SelectItem>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="cursor-pointer text-xs">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {isAdaptedVersion && onDeleteVersion && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmDeleteVersion(true)}
                  className="size-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  title={t("delete_version_tooltip")}
                >
                  <Trash2 size={15} />
                </Button>
              )}
              {onOpenATS && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenATS}
                  className={cn(
                    "h-9 px-3 gap-1.5 text-xs font-semibold shrink-0 rounded-lg",
                    "text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50 bg-transparent",
                    atsButtonShine && "shine-diamond",
                  )}
                  title={t("ats_button_tooltip")}
                >
                  <ShieldCheck size={14} />
                  {t("ats_button")}
                </Button>
              )}
            </div>
          )}

          {/* Sélecteur de Template (dropdown, comme le choix de modèle IA) */}
          <Select value={tpl} onValueChange={(val) => val && onTemplateChange(val)}>
            <SelectTrigger className="h-9 w-[160px] rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors text-xs gap-1.5">
              <LayoutTemplate size={13} className="text-primary shrink-0" />
              <span className="text-[10px] text-muted-foreground">{t("label_template")}</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border shadow-md rounded-lg p-1">
              <SelectGroup>
                {TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="cursor-pointer text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {mounted && (
          <div className="flex items-center gap-2">
            {isOverflowing && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                <AlertTriangle size={13} />
                {t("overflow_warning")}
              </div>
            )}
            {downloadError && !isOverflowing && (
              <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                <AlertTriangle size={13} />
                {t("download_error")}
              </div>
            )}
          <Button
            onClick={handleDownload}
            disabled={isDownloading || isOverflowing}
            className="h-9 px-4 text-xs gap-1.5 font-semibold shadow-md shadow-primary/25 bg-gradient-to-b from-primary to-primary/90 hover:shadow-lg hover:shadow-primary/30 transition-all"
          >
            {isDownloading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t("downloading")}
              </>
            ) : (
              <>
                <Download size={14} />
                {t("download")}
              </>
            )}
          </Button>
          </div>
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
                      {t("cv_original")}
                    </div>
                    <PdfIframe url={originalUrl} loading={originalLoading} />
                  </div>

                  <div className="flex-1 flex flex-col gap-2 min-h-0">
                    <div className="text-sm font-medium text-success text-center shrink-0">
                      {t("cv_adapted_visual")}
                    </div>
                    <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0 flex flex-col">
                      <CVInteractiveCanvas
                        data={data}
                        onChange={handleCanvasChange}
                        template={template}
                        originalData={originalData}
                        onOverflowChange={setIsOverflowing}
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
                    {t("cv_original")}
                  </div>
                  <PdfIframe url={originalUrl} loading={originalLoading} />
                </div>
              )}

              <div className="flex-1 flex flex-col gap-2 min-h-0">
                {originalData && sideBySide && (
                  <div className="text-sm font-medium text-success text-center">
                    {t("cv_adapted_highlighted")}
                  </div>
                )}
                <PdfIframe url={adaptedUrl} loading={adaptedLoading} />
              </div>
            </div>
          )}
        </div>
        {isAdapting && <AIAdaptOverlay type="cv" />}
      </div>
    </div>
  );
}

function PdfIframe({ url, loading }: { url: string | null; loading: boolean }) {
  const t = useTranslations("CVPreview");
  return (
    <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0 relative">
      {(loading || !url) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-card">
          <Loader2 className="animate-spin text-primary" size={28} />
          <span className="text-xs text-muted-foreground">{t("generating_pdf")}</span>
        </div>
      )}
      {url && (
        <iframe
          src={url}
          className="w-full h-full border-none"
          title="PDF preview"
        />
      )}
    </div>
  );
}
