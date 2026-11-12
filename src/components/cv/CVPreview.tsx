"use client";

import React, { useState, useCallback, useSyncExternalStore, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import CVInteractiveCanvas from "./CVInteractiveCanvas";
import { AIProgressOverlay } from "./AIProgress";
import { Spinner } from "@/components/ui/motion";
import { DownloadMenu } from "./DownloadMenu";
import type { CVData } from "@/types/cv";
import { normalizeTemplate } from "@/lib/cv-layout";
import { TEMPLATES } from "@/lib/cv-templates";
import { TemplateThumbnail } from "./TemplateThumbnail";
import { safeFileName, stripHtml } from "@/utils/strip-html";
import { LayoutPanelLeft, History, AlertTriangle, LayoutTemplate, Trash2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, type PageSizeId } from "@/lib/page-size";
import { cvToPlainText } from "@/lib/cv-text";
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
  // Inputs of the last request that settled (success or failure). "Loading"
  // is derived from it instead of being set synchronously inside the effect.
  const [settled, setSettled] = useState<{
    data: CVData | null;
    template: string;
    originalData?: CVData | null;
    sideBySide?: boolean;
  } | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Disabled: nothing to fetch. The last blob URL is kept (revoked when it
    // is replaced or on unmount) so re-enabling shows it while refreshing.
    if (!enabled || !data) return;

    let cancelled = false;
    const inputs = { data, template, originalData, sideBySide };

    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/render-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(inputs),
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
        if (!cancelled) setSettled(inputs);
      }
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, data, template, originalData, sideBySide]);

  useEffect(() => {
    return () => {
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, []);

  const active = enabled && !!data;
  const pending =
    !settled ||
    settled.data !== data ||
    settled.template !== template ||
    settled.originalData !== originalData ||
    settled.sideBySide !== sideBySide;
  return { url: active ? url : null, loading: active && pending };
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
  const [downloadError, setDownloadError] = useState<null | "generic" | "too_large" | "docx">(null);
  const [isDownloadingDocx, setIsDownloadingDocx] = useState(false);
  const [confirmDeleteVersion, setConfirmDeleteVersion] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Le CV affiché est-il une adaptation supprimable (≠ CV principal) ?
  const selectedVersionId = currentProfileId ?? mainProfileId;
  const isAdaptedVersion = !!currentProfileId && currentProfileId !== mainProfileId;
  const selectedVersionName = stripHtml(versions.find((v) => v.id === currentProfileId)?.name ?? "");

  // Template normalisé : les anciennes lignes "chaima" → "modern".
  const tpl = normalizeTemplate(template);
  const TEMPLATE_OPTIONS = TEMPLATES.map((tp) => ({ id: tp.id, label: t(`template_${tp.id}`) }));
  const templateLabel = (id: unknown) => TEMPLATE_OPTIONS.find((o) => o.id === id)?.label ?? String(id ?? "");

  const handleCanvasChange = (newData: CVData) => {
    if (onChange) onChange(newData);
  };

  // Server-side PDF generation. Un contenu qui déborde reste exportable :
  // la bannière du canvas propose de le faire tenir, sans bloquer.
  const isPdf = mode === "pdf";
  const needsOriginalPdf = sideBySide && !!originalData;
  // Positions pas encore mesurées par le canvas (effacées après un import, une
  // adaptation IA, un changement de modèle) : voir le canvas caché plus bas.
  const needsLayout = Object.keys(data.layout?.absolutePositions ?? {}).length === 0;

  const { url: originalUrl, loading: originalLoading } = useServerPdfUrl(
    originalData ?? null, template, needsOriginalPdf
  );
  const { url: adaptedUrl, loading: adaptedLoading } = useServerPdfUrl(
    data, template, isPdf, originalData, sideBySide
  );

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/render-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, template }),
      });
      if (res.status === 413) setDownloadError("too_large");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName(["CV", data.personalInfo.name, data.personalInfo.role])}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
      setDownloadError((prev) => prev ?? "generic");
    } finally {
      setIsDownloading(false);
    }
  }, [data, template]);

  // DOCX (une colonne, ordre de lecture) généré côté serveur par /api/render-docx.
  const handleDownloadDocx = useCallback(async () => {
    setIsDownloadingDocx(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/render-docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, template }),
      });
      if (res.status === 413) setDownloadError("too_large");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFileName(["CV", data.personalInfo.name, data.personalInfo.role])}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("DOCX download failed:", err);
      setDownloadError((prev) => prev ?? "docx");
    } finally {
      setIsDownloadingDocx(false);
    }
  }, [data, template]);

  const handleDownloadText = useCallback(() => {
    // BOM UTF-8 : les accents s'affichent correctement dans le Bloc-notes Windows.
    const blob = new Blob(["﻿", cvToPlainText(data)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(["CV", data.personalInfo.name, data.personalInfo.role])}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [data]);

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
        <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
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
                <SelectContent className="p-1">
                  <SelectGroup>
                    <SelectItem value={mainProfileId} className="cursor-pointer text-xs">
                      <MarqueeText text={t("version_main")} />
                    </SelectItem>
                    {versions.map((v) => (
                      <SelectItem key={v.id} value={v.id} className="cursor-pointer text-xs">
                        <MarqueeText text={stripHtml(v.name)} />
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
                    atsButtonShine && "motion-attention",
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
            <SelectTrigger className="h-9 w-[150px] rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors text-xs gap-1.5" title={t("label_template")}>
              <LayoutTemplate size={13} className="text-primary shrink-0" />
              <SelectValue>{templateLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent className="p-1 w-[300px]" alignItemWithTrigger={false}>
              <SelectGroup className="grid grid-cols-3 gap-1">
                {TEMPLATE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.id}
                    value={opt.id}
                    className="cursor-pointer text-xs pr-2"
                  >
                    <div className="flex w-full min-w-0 flex-col items-center gap-1">
                      <TemplateThumbnail templateId={opt.id} className="!size-auto w-full rounded-sm shadow-sm" />
                      <span className="w-full truncate text-center">{opt.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Format de page : A4 (Europe) ou Letter (Amérique du Nord). */}
          <Select
            value={data.layout?.pageSize ?? DEFAULT_PAGE_SIZE}
            onValueChange={(val) => {
              if (!val || !data.layout || !onChange) return;
              onChange({ ...data, layout: { ...data.layout, pageSize: val as PageSizeId } });
            }}
          >
            <SelectTrigger className="h-9 w-[96px] rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors text-xs gap-1.5" title={t("label_page_size")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="p-1">
              <SelectGroup>
                <SelectItem value="A4" className="cursor-pointer text-xs">A4</SelectItem>
                <SelectItem value="LETTER" className="cursor-pointer text-xs">Letter</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {mounted && (
          <div className="flex shrink-0 items-center gap-2">
            {isOverflowing && (
              <div className="flex items-center gap-1.5 text-amber-600 text-xs font-medium">
                <AlertTriangle size={13} />
                {t("overflow_warning")}
              </div>
            )}
            {downloadError && !isOverflowing && (
              <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                <AlertTriangle size={13} />
                {downloadError === "too_large" ? t("pdf_too_large") : downloadError === "docx" ? t("download_docx_error") : t("download_error")}
              </div>
            )}
            {/* Un seul bouton de téléchargement : PDF (mise en page complète),
                Word (une colonne, mise en forme conservée) et texte brut (le plus
                sûr pour les ATS et les formulaires de candidature). */}
            <DownloadMenu
              label={t("download_menu")}
              busyLabel={t("downloading")}
              formats={[
                { id: "pdf", label: "PDF", description: t("format_pdf_desc"), onSelect: handleDownload, busy: isDownloading },
                { id: "docx", label: "DOCX", description: t("format_docx_desc"), onSelect: handleDownloadDocx, busy: isDownloadingDocx },
                { id: "txt", label: "TXT", description: t("format_txt_desc"), onSelect: handleDownloadText },
              ]}
            />
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
                    onOverflowChange={setIsOverflowing}
                  />
                </div>
              )}
            </div>
          )}

          {/* Mise en page à recalculer (CV importé, adapté, modèle changé…) alors
              que l'aperçu PDF est affiché : c'est le canvas qui mesure les
              hauteurs réelles et écrit les positions. Sans lui, le PDF tombait
              sur les positions ESTIMÉES (sections qui se chevauchent). On le
              monte donc, invisible, le temps de ce calcul. */}
          {mounted && mode === "pdf" && needsLayout && (
            <div aria-hidden className="pointer-events-none invisible absolute inset-0 -z-10 overflow-hidden">
              <CVInteractiveCanvas
                data={data}
                onChange={handleCanvasChange}
                template={template}
                onOverflowChange={setIsOverflowing}
              />
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
        <AIProgressOverlay active={isAdapting} kind="cv" />
      </div>
    </div>
  );
}

/**
 * Libellé qui défile au survol quand il dépasse de son conteneur. Le décalage
 * exact est mesuré (scrollWidth − clientWidth) → aucun mouvement si le texte
 * tient déjà ; vitesse constante (~45 px/s) pour les noms longs. L'animation est
 * pilotée par CSS via `:hover` du SelectItem parent (cf. globals.css).
 */
function MarqueeText({ text }: { text: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;
    const overflow = inner.scrollWidth - wrap.clientWidth;
    setShift(overflow > 1 ? overflow : 0);
  }, [text]);

  const duration = Math.max(1.5, shift / 45);

  // Largeur FIXE (le SelectItem fait 210px : −pl-2 −pr-8 ≈ 168px utiles). Sans
  // borne, le parent `ItemText` (shrink-0 + whitespace-nowrap) s'étire au texte
  // complet → aucun débordement détecté → le marquee ne bougerait jamais.
  return (
    <span ref={wrapRef} className="block w-[168px] overflow-hidden whitespace-nowrap">
      <span
        ref={innerRef}
        className="marquee-track inline-block whitespace-nowrap"
        style={{ "--marquee-shift": `-${shift}px`, "--marquee-dur": `${duration}s` } as React.CSSProperties}
      >
        {text}
      </span>
    </span>
  );
}

function PdfIframe({ url, loading }: { url: string | null; loading: boolean }) {
  const t = useTranslations("CVPreview");
  return (
    <div className="flex-1 rounded-lg overflow-hidden border border-border bg-card shadow-sm min-h-0 relative">
      {(loading || !url) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-card">
          <Spinner size={24} className="text-primary" />
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
