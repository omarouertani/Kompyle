"use client";

import React from "react";
import type { CoverLetterData, PersonalInfo } from "@/types/cv";
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

  const handleChange = (field: keyof CoverLetterData, value: string | string[]) => {
    onChange({ ...data, [field]: value });
  };

  const handleParagraphChange = (index: number, value: string) => {
    const newParagraphs = [...data.paragraphs];
    newParagraphs[index] = value;
    handleChange("paragraphs", newParagraphs);
  };

  const addParagraph = () => {
    handleChange("paragraphs", [...data.paragraphs, "Nouveau paragraphe..."]);
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
          <SectionHeading icon={User}>Expéditeur (depuis le CV)</SectionHeading>
          <div className="border border-border/60 rounded-lg p-3.5 bg-muted/20 flex flex-col gap-0.5">
            <span className="text-sm font-semibold text-foreground">
              {personalInfo.name || "— Nom non renseigné dans le CV —"}
            </span>
            {personalInfo.role && <span className="text-xs text-muted-foreground">{personalInfo.role}</span>}
            {(personalInfo.email || personalInfo.phone) && (
              <span className="text-xs text-muted-foreground">
                {[personalInfo.email, personalInfo.phone].filter(Boolean).join(" • ")}
              </span>
            )}
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              Le nom, le titre et la signature de la lettre sont automatiquement repris des
              informations personnelles du CV actif — modifiez-les dans l&apos;onglet Edit CV.
            </p>
          </div>
        </section>
      )}

      {/* ── En-tête (Destinataire & Date) ── */}
      <section>
        <SectionHeading icon={Building}>Informations du Destinataire</SectionHeading>
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label>Nom du destinataire</Label>
            <Input
              value={data.recipientName}
              onChange={(e) => handleChange("recipientName", e.target.value)}
              placeholder="Ex: M. Dupont ou Responsable Recrutement"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Nom de l&apos;entreprise</Label>
            <Input
              value={data.recipientCompany}
              onChange={(e) => handleChange("recipientCompany", e.target.value)}
              placeholder="Ex: Tech Corp"
            />
          </div>
          <div className="flex flex-col gap-2 col-span-2">
            <Label>Adresse de l&apos;entreprise (Optionnel)</Label>
            <Input
              value={data.recipientAddress || ""}
              onChange={(e) => handleChange("recipientAddress", e.target.value)}
              placeholder="Ex: 123 Rue de la Paix, 75000 Paris"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Date</Label>
            <Input
              value={data.date}
              onChange={(e) => handleChange("date", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Corps de la Lettre ── */}
      <section>
        <SectionHeading icon={FileText}>Objet & Corps de la Lettre</SectionHeading>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Objet de la lettre</Label>
            <Input
              value={data.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              className="font-semibold"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Salutation</Label>
            <Input
              value={data.salutation}
              onChange={(e) => handleChange("salutation", e.target.value)}
              placeholder="Ex: Madame, Monsieur,"
            />
          </div>
          
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center">
              <Label>Paragraphes</Label>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={addParagraph}>
                <Plus size={14} /> Ajouter un paragraphe
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
                  title="Supprimer ce paragraphe"
                >
                  <X size={16} />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            <Label>Formule de politesse (Signature)</Label>
            <Input
              value={data.signOff}
              onChange={(e) => handleChange("signOff", e.target.value)}
              placeholder="Ex: Veuillez agréer, Madame, Monsieur..."
            />
          </div>
        </div>
      </section>
    </div>
  );
}
