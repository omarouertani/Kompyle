"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Upload, X } from "lucide-react";
import type { CoverLetterData, CoverLetterTemplateId, CVTheme, PersonalInfo } from "@/types/cv";
import { defaultLetterDate } from "./CoverLetterTemplate";
import { FONT_FAMILIES } from "./canvas/ThemePanel";
import { resizeImageToDataUrl } from "@/utils/resize-image";
import { stripHtml } from "@/utils/strip-html";
import { cn } from "@/lib/utils";

/** Largeur d'une page A4 en px CSS (595,28 pt). Les mesures ci-dessous
 *  reprennent celles du PDF (CoverLetterTemplate) converties pt → px. */
const PT = 96 / 72;
const A4_W = 595.28 * PT;
const A4_H = 841.89 * PT;
const pt = (v: number) => `${v * PT}px`;

/**
 * Champ de texte éditable SUR la page (texte brut uniquement : le PDF de la
 * lettre n'interprète pas le HTML). Le DOM n'est réécrit qu'hors édition, pour
 * ne jamais déplacer le curseur pendant la frappe.
 */
function LetterField({
  value,
  onChange,
  placeholder,
  className,
  style,
  multiline = false,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !focused.current && el.innerText !== value) el.innerText = value;
  }, [value]);

  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={ariaLabel ?? placeholder}
      aria-multiline={multiline}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      data-placeholder={placeholder}
      spellCheck
      onFocus={() => (focused.current = true)}
      onBlur={(e) => {
        focused.current = false;
        const text = e.currentTarget.innerText.replace(/\n+$/, "");
        if (text !== value) onChange(text);
      }}
      onInput={(e) => onChange(e.currentTarget.innerText)}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={cn(
        "rounded-sm outline-none whitespace-pre-wrap break-words transition-shadow",
        "hover:ring-1 hover:ring-primary/30 focus:ring-2 focus:ring-primary/50",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-zinc-400 empty:before:italic",
        className
      )}
      style={style}
    />
  );
}

interface CoverLetterCanvasProps {
  data: CoverLetterData;
  onChange: (data: CoverLetterData) => void;
  personalInfo: PersonalInfo;
  theme?: CVTheme;
  locale: string;
  subjectPrefix: string;
}

/**
 * Éditeur « canvas » de la lettre de motivation : la page A4 telle qu'elle sera
 * exportée, éditable directement (texte, modèle, signature, paragraphes). Plus
 * limité que le canvas du CV : une lettre n'a pas de blocs libres à placer.
 */
export function CoverLetterCanvas({ data, onChange, personalInfo, theme, locale, subjectPrefix }: CoverLetterCanvasProps) {
  const t = useTranslations("LetterBuilder");
  const hostRef = useRef<HTMLDivElement>(null);
  const signatureInput = useRef<HTMLInputElement>(null);
  const [scale, setScale] = useState(1);
  const [signatureError, setSignatureError] = useState(false);

  // La page s'adapte à la largeur disponible (jamais agrandie au-delà de 100 %).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, (entry.contentRect.width - 32) / A4_W)));
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const set = <K extends keyof CoverLetterData>(key: K, value: CoverLetterData[K]) => onChange({ ...data, [key]: value });
  const setParagraph = (i: number, v: string) => set("paragraphs", data.paragraphs.map((p, j) => (j === i ? v : p)));

  const modern = data.template === "modern";
  const textColor = theme?.textColor || "#000000";
  const accent = theme?.primaryColor || textColor;
  const fontFamily = FONT_FAMILIES[theme?.fontFamily ?? "sans"]?.stack;
  const senderColor = modern ? "#ffffff" : theme?.textColor || "#444444";

  const name = stripHtml(personalInfo.name).trim();
  const contact = [stripHtml(personalInfo.email), stripHtml(personalInfo.phone)].map((s) => s.trim()).filter(Boolean).join(" • ");
  const links = [stripHtml(personalInfo.linkedin ?? ""), stripHtml(personalInfo.portfolio ?? "")].map((s) => s.trim()).filter(Boolean).join(" • ");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Barre d'outils limitée : modèle, signature, paragraphe */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/50 p-0.5" role="radiogroup" aria-label={t("template")}>
          {(["classic", "modern"] as CoverLetterTemplateId[]).map((id) => {
            const active = (data.template ?? "classic") === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set("template", id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`template_${id}`)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => set("paragraphs", [...data.paragraphs, t("new_paragraph")])}
          className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus size={12} /> {t("add_paragraph")}
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => signatureInput.current?.click()}
            className="flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t("signature_hint")}
          >
            <Upload size={12} /> {data.signature ? t("signature_change") : t("signature_add")}
          </button>
          {data.signature && (
            <button
              type="button"
              onClick={() => set("signature", undefined)}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title={t("signature_remove")}
              aria-label={t("signature_remove")}
            >
              <X size={13} />
            </button>
          )}
          <input
            ref={signatureInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                setSignatureError(false);
                set("signature", await resizeImageToDataUrl(file, 400, 0.9, "png"));
              } catch {
                setSignatureError(true);
              }
            }}
          />
        </div>
        {signatureError && <span className="text-xs text-destructive">{t("signature_error")}</span>}
      </div>

      {/* Page A4 éditable */}
      <div ref={hostRef} className="min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/40 py-4">
        <div className="mx-auto" style={{ width: A4_W * scale, height: A4_H * scale }}>
          <div
            className="origin-top-left shadow-lg"
            style={{
              width: A4_W,
              minHeight: A4_H,
              transform: `scale(${scale})`,
              fontFamily,
              fontSize: pt(11),
              lineHeight: 1.5,
              color: textColor,
              backgroundColor: theme?.pageBg || "#ffffff",
              padding: modern ? `0 0 ${pt(40)}` : `${pt(40)} ${pt(50)}`,
            }}
          >
            {/* Expéditeur — repris du CV (non éditable ici) */}
            <div
              title={t("sender_hint_canvas")}
              style={
                modern
                  ? { backgroundColor: accent, padding: `${pt(32)} ${pt(50)} ${pt(22)}`, marginBottom: pt(30) }
                  : { marginBottom: pt(30), paddingBottom: pt(10), borderBottom: `1px solid ${accent}` }
              }
            >
              <div style={{ fontSize: pt(modern ? 22 : 18), fontWeight: 700, color: modern ? "#ffffff" : accent, marginBottom: pt(4) }}>
                {name || t("sender_no_name")}
              </div>
              {[stripHtml(personalInfo.role).trim(), contact, stripHtml(personalInfo.location).trim(), links].filter(Boolean).map((line, i) => (
                <div key={i} style={{ fontSize: pt(10), color: senderColor, marginBottom: pt(2) }}>{line}</div>
              ))}
            </div>

            <div style={modern ? { padding: `0 ${pt(50)}` } : undefined}>
              {/* Destinataire & date */}
              <div className="flex justify-between gap-6" style={{ marginBottom: pt(30) }}>
                <div className="flex flex-1 flex-col" style={{ gap: pt(2) }}>
                  <LetterField value={data.recipientName} onChange={(v) => set("recipientName", v)} placeholder={t("recipient_name_ph")} className="font-bold" />
                  <LetterField value={data.recipientCompany} onChange={(v) => set("recipientCompany", v)} placeholder={t("recipient_company_ph")} className="font-bold" />
                  <LetterField value={data.recipientAddress ?? ""} onChange={(v) => set("recipientAddress", v)} placeholder={t("recipient_address_ph")} />
                </div>
                <LetterField value={data.date} onChange={(v) => set("date", v)} placeholder={defaultLetterDate(locale)} ariaLabel={t("date")} className="flex-1 text-right" />
              </div>

              {/* Objet */}
              <div className="flex gap-1 font-bold" style={{ marginBottom: pt(20), color: accent }}>
                <span className="shrink-0">{subjectPrefix}</span>
                <LetterField value={data.subject} onChange={(v) => set("subject", v)} placeholder={t("subject")} className="flex-1" />
              </div>

              <LetterField value={data.salutation} onChange={(v) => set("salutation", v)} placeholder={t("salutation_ph")} style={{ marginBottom: pt(15) }} />

              {/* Corps : un paragraphe = un bloc, supprimable au survol */}
              {data.paragraphs.map((para, i) => (
                <div key={i} className="group/para relative" style={{ marginBottom: pt(15) }}>
                  <LetterField value={para} onChange={(v) => setParagraph(i, v)} multiline className="text-justify" ariaLabel={`${t("paragraphs")} ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() => set("paragraphs", data.paragraphs.filter((_, j) => j !== i))}
                    className="absolute -right-7 top-0 rounded p-1 text-zinc-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover/para:opacity-100"
                    title={t("remove_paragraph")}
                    aria-label={t("remove_paragraph")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Formule de politesse + signature */}
              <div style={{ marginTop: pt(20) }}>
                <LetterField value={data.signOff} onChange={(v) => set("signOff", v)} placeholder={t("signoff_ph")} multiline style={{ marginBottom: pt(data.signature ? 6 : 30) }} />
                {data.signature && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL
                  <img src={data.signature} alt={t("signature")} style={{ width: pt(140), maxHeight: pt(60), objectFit: "contain", marginBottom: pt(6) }} />
                )}
                <div className="font-bold">{name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
