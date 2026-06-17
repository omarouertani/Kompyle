"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { CoverLetterData, PersonalInfo } from "@/types/cv";
import { stripHtml } from "@/utils/strip-html";
import { Building, FileText, Plus, X, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CoverLetterBuilderProps {
  data: CoverLetterData;
  onChange: (newData: CoverLetterData) => void;
  /** Infos expéditeur — toujours reprises du CV actif (nom, prénom, contact). */
  personalInfo?: PersonalInfo;
}

/* ── Section heading component for consistent styling ── */
function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground mb-5 pb-2.5 border-b border-border">
      <Icon size={18} className="text-primary" />
      {children}
    </h2>
  );
}

export default function CoverLetterBuilder({ data, onChange, personalInfo }: CoverLetterBuilderProps) {
  const t = useTranslations("LetterBuilder");

  const handleChange = (field: keyof CoverLetterData, value: string | string[]) => {
    onChange({ ...data, [field]: value });
  };

  const handleParagraphChange = (index: number, value: string) => {
    const newParagraphs = [...data.paragraphs];
    newParagraphs[index] = value;
    handleChange("paragraphs", newParagraphs);
  };

  const addParagraph = () => {
    handleChange("paragraphs", [...data.paragraphs, t("new_paragraph")]);
  };

  const removeParagraph = (index: number) => {
    const newParagraphs = data.paragraphs.filter((_, i) => i !== index);
    handleChange("paragraphs", newParagraphs);
  };

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* ── Expéditeur (repris du CV) ── */}
      {personalInfo && (
        <section>
          <SectionHeading icon={User}>{t("sender_section")}</SectionHeading>
          <div className="border border-border/60 rounded-lg p-3.5 bg-muted/20 flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {stripHtml(personalInfo.name) || t("sender_no_name")}
            </span>
            {personalInfo.role && <span className="text-xs text-muted-foreground">{stripHtml(personalInfo.role)}</span>}
            {(personalInfo.email || personalInfo.phone) && (
              <span className="text-xs text-muted-foreground">
                {[stripHtml(personalInfo.email), stripHtml(personalInfo.phone)].filter(Boolean).join(" • ")}
              </span>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {t("sender_hint")}
            </p>
          </div>
        </section>
      )}

      {/* ── En-tête (Destinataire & Date) ── */}
      <section>
        <SectionHeading icon={Building}>{t("recipient_section")}</SectionHeading>
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t("recipient_name")}</Label>
            <Input
              value={data.recipientName}
              onChange={(e) => handleChange("recipientName", e.target.value)}
              placeholder={t("recipient_name_ph")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("recipient_company")}</Label>
            <Input
              value={data.recipientCompany}
              onChange={(e) => handleChange("recipientCompany", e.target.value)}
              placeholder={t("recipient_company_ph")}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-2">
            <Label>{t("recipient_address")}</Label>
            <Input
              value={data.recipientAddress || ""}
              onChange={(e) => handleChange("recipientAddress", e.target.value)}
              placeholder={t("recipient_address_ph")}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("date")}</Label>
            <Input
              value={data.date}
              onChange={(e) => handleChange("date", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Corps de la Lettre ── */}
      <section>
        <SectionHeading icon={FileText}>{t("body_section")}</SectionHeading>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>{t("subject")}</Label>
            <Input
              value={data.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              className="font-semibold"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("salutation")}</Label>
            <Input
              value={data.salutation}
              onChange={(e) => handleChange("salutation", e.target.value)}
              placeholder={t("salutation_ph")}
            />
          </div>

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center">
              <Label>{t("paragraphs")}</Label>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={addParagraph}>
                <Plus size={14} /> {t("add_paragraph")}
              </Button>
            </div>

            {data.paragraphs.map((para, i) => (
              <div key={i} className="flex gap-2.5 items-start">
                <Textarea
                  value={para}
                  onChange={(e) => handleParagraphChange(i, e.target.value)}
                  rows={4}
                  className="flex-1 resize-y"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 mt-1"
                  onClick={() => removeParagraph(i)}
                  title={t("remove_paragraph")}
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <Label>{t("signoff")}</Label>
            <Input
              value={data.signOff}
              onChange={(e) => handleChange("signOff", e.target.value)}
              placeholder={t("signoff_ph")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
