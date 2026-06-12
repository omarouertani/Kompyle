"use client";

import React from "react";
import type { CVData, CVTheme, Experience, Project, Education, SkillGroup } from "@/types/cv";
import { cn } from "@/lib/utils";
import { Trash2, PlusCircle } from "lucide-react";
import { EditableText, ptsToPx } from "../cv-canvas-primitives";
import { CanvasSectionHeading } from "../canvas-section-heading";
import { getSectionLabel, renameSection } from "@/lib/cv-layout";

export interface BlockTheme {
  isChaima: boolean;
  primaryColor: string;
  baseFontSize: number;
  headingFontSize: number;
  lineHeight: number;
  photoSize: number;
}

interface BlockContentProps {
  blockId: string;
  data: CVData;
  theme: BlockTheme;
  onChange: (newData: CVData) => void;
}

/** Contenu éditable d'un bloc du canvas, identifié par son blockId
 *  (title_*, content_*, skill_N, experience_N, project_N, education_N,
 *  name, role, techLine, photo). Retourne null si l'id est inconnu. */
export function BlockContent({ blockId, data, theme, onChange }: BlockContentProps) {
  const { isChaima, primaryColor, baseFontSize, headingFontSize, lineHeight: lh, photoSize } = theme;
  const { personalInfo } = data;
  const toPx = ptsToPx;

  const updatePersonalInfo = (field: string, value: string) =>
    onChange({ ...data, personalInfo: { ...personalInfo, [field]: value } });

  const updateTheme = (updates: Partial<CVTheme>) =>
    onChange({ ...data, layout: { ...data.layout!, theme: { ...data.layout?.theme, ...updates } } });

  const updateItem = <T,>(list: T[], index: number, patch: Partial<T>): T[] => {
    const next = [...list];
    next[index] = { ...next[index], ...patch };
    return next;
  };

  const updateExperience = <K extends keyof Experience>(idx: number, field: K, value: Experience[K]) =>
    onChange({ ...data, experiences: updateItem(data.experiences, idx, { [field]: value } as Partial<Experience>) });

  const updateBullets = (expIdx: number, bullets: string[]) =>
    onChange({ ...data, experiences: updateItem(data.experiences, expIdx, { bullets }) });

  const updateProject = <K extends keyof Project>(idx: number, field: K, value: Project[K]) =>
    onChange({ ...data, projects: updateItem(data.projects, idx, { [field]: value } as Partial<Project>) });

  const updateEducation = <K extends keyof Education>(idx: number, field: K, value: Education[K]) =>
    onChange({ ...data, education: updateItem(data.education, idx, { [field]: value } as Partial<Education>) });

  const updateSkillGroup = <K extends keyof SkillGroup>(idx: number, field: K, value: SkillGroup[K]) =>
    onChange({ ...data, skills: updateItem(data.skills, idx, { [field]: value } as Partial<SkillGroup>) });

  // --- Header ---
  if (blockId === "name") {
    return (
      <EditableText value={personalInfo.name} onChange={(v) => updatePersonalInfo("name", v)} className={cn("font-bold tracking-tight select-text text-zinc-900 leading-snug", isChaima && "uppercase")} style={{ fontSize: toPx(baseFontSize * 2.4) }} placeholder="Nom complet" />
    );
  }

  if (blockId === "role") {
    return (
      <EditableText value={personalInfo.role} onChange={(v) => updatePersonalInfo("role", v)} className={cn("font-bold tracking-wider", isChaima && "uppercase")} style={{ fontSize: toPx(baseFontSize + 1.5), color: primaryColor, lineHeight: 1.2 }} placeholder="Titre professionnel" />
    );
  }

  if (blockId === "techLine") {
    return (
      <EditableText value={personalInfo.techLine} onChange={(v) => updatePersonalInfo("techLine", v)} className="text-zinc-500 leading-snug" style={{ fontSize: toPx(baseFontSize - 1) }} placeholder="Technologies clés" />
    );
  }

  if (blockId === "photo") {
    return (
      <div className="flex justify-center items-center">
        <div
          className={cn("rounded-full overflow-hidden border bg-zinc-200 flex items-center justify-center shadow-sm", isChaima && "border-2")}
          style={{ width: toPx(photoSize), height: toPx(photoSize), borderColor: isChaima ? primaryColor : "#d4d4d8" }}
        >
          {personalInfo.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL / source dynamique, next/image inadapté
            <img src={personalInfo.photo} alt="Avatar" className="size-full object-cover" />
          ) : (
            <svg viewBox="0 0 100 100" className="size-full"><circle cx="50" cy="40" r="18" fill="#475569" /><path d="M 22,82 C 22,65 34,58 50,58 C 66,58 78,65 78,82 C 78,85 75,85 50,85 C 25,85 22,85 22,82 Z" fill="#475569" /></svg>
          )}
        </div>
      </div>
    );
  }

  // --- Sections personnalisées ---
  if (blockId.startsWith("title_custom_") || blockId.startsWith("content_custom_")) {
    const isTitle = blockId.startsWith("title_");
    const sectionId = blockId.substring(isTitle ? 6 : 8);
    const idx = (data.customSections ?? []).findIndex((c) => `custom_${c.id}` === sectionId);
    const cs = data.customSections?.[idx];
    if (!cs) return null;

    const updateCustom = (patch: Partial<typeof cs>) =>
      onChange({ ...data, customSections: updateItem(data.customSections!, idx, patch) });

    return isTitle ? (
      <EditableText
        value={cs.title}
        onChange={(v) => updateCustom({ title: v })}
        className="font-bold uppercase tracking-wide block w-full border-b pb-0.5"
        style={{ fontSize: toPx(headingFontSize), color: primaryColor, borderColor: primaryColor }}
        placeholder="Titre de section"
      />
    ) : (
      <EditableText
        value={cs.content}
        onChange={(v) => updateCustom({ content: v })}
        className="text-zinc-700 w-full text-left"
        style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
        multiline
        placeholder="Contenu de la section..."
      />
    );
  }

  // --- Titres de section (built-in, renommables) ---
  if (blockId.startsWith("title_")) {
    const sectionId = blockId.substring(6);
    return (
      <CanvasSectionHeading
        title={getSectionLabel(sectionId, data)}
        blockId={blockId}
        headingFontSize={headingFontSize}
        primaryColor={primaryColor}
        onFontSizeChange={(s) => updateTheme({ headingSize: s })}
        onTitleChange={(title) => onChange(renameSection(data, sectionId, title))}
      />
    );
  }

  // --- Contenus ---
  if (blockId === "content_contact") {
    const fields = [
      { label: "Email", field: "email", value: personalInfo.email },
      { label: "Téléphone", field: "phone", value: personalInfo.phone },
      { label: "Localisation", field: "location", value: personalInfo.location },
      { label: "LinkedIn", field: "linkedin", value: personalInfo.linkedin },
      ...(personalInfo.portfolio !== undefined
        ? [{ label: "Portfolio", field: "portfolio", value: personalInfo.portfolio }]
        : []),
    ];
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {fields.map(({ label, field, value }) => (
          <div key={field} className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</span>
            <EditableText value={value} onChange={(v) => updatePersonalInfo(field, v)} className="font-medium text-zinc-800 break-all" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} />
          </div>
        ))}
      </div>
    );
  }

  if (blockId.startsWith("skill_")) {
    const idx = parseInt(blockId.split("_")[1]);
    const group = data.skills[idx];
    if (!group) return null;
    return (
      <div className="flex flex-col w-full text-left">
        <EditableText value={group.category} onChange={(v) => updateSkillGroup(idx, "category", v)} className="font-bold text-zinc-800" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} placeholder="Catégorie" />
        <EditableText value={group.items} onChange={(v) => updateSkillGroup(idx, "items", v)} className="text-zinc-600 mt-0.5" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} placeholder="Compétence 1, Compétence 2..." />
      </div>
    );
  }

  if (blockId === "content_languages") {
    return (
      <div className="flex flex-col gap-1 w-full text-left">
        {data.spokenLanguages.map((lang, i) => (
          <EditableText
            key={i}
            value={lang}
            onChange={(v) => {
              const next = [...data.spokenLanguages];
              next[i] = v;
              onChange({ ...data, spokenLanguages: next });
            }}
            className="text-zinc-800"
            style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
            placeholder="ex: Français (Natif)"
          />
        ))}
      </div>
    );
  }

  if (blockId.startsWith("education_")) {
    const idx = parseInt(blockId.split("_")[1]);
    const edu = data.education[idx];
    if (!edu) return null;
    return (
      <div className="flex flex-col w-full text-left">
        <EditableText value={edu.degree} onChange={(v) => updateEducation(idx, "degree", v)} className="font-bold text-zinc-900 leading-snug" style={{ fontSize: toPx(baseFontSize) }} placeholder="Diplôme" />
        <EditableText value={edu.institution} onChange={(v) => updateEducation(idx, "institution", v)} className="text-zinc-600 italic leading-snug mt-0.5" style={{ fontSize: toPx(baseFontSize) }} placeholder="Institution" />
      </div>
    );
  }

  if (blockId === "content_summary") {
    return (
      <EditableText value={personalInfo.summary} onChange={(v) => updatePersonalInfo("summary", v)} className="text-justify text-zinc-700 font-sans w-full" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} multiline placeholder="Rédigez votre résumé professionnel ici..." />
    );
  }

  if (blockId.startsWith("experience_")) {
    const idx = parseInt(blockId.split("_")[1]);
    const exp = data.experiences[idx];
    if (!exp) return null;
    return (
      <div className="flex flex-col w-full text-left group/exp relative">
        <div className="flex justify-between items-start leading-snug">
          <div className="flex-1 font-bold text-zinc-900 pr-4">
            <EditableText value={exp.title} onChange={(v) => updateExperience(idx, "title", v)} placeholder="Poste" style={{ fontSize: toPx(baseFontSize + 0.5) }} />
            <span className="text-zinc-400 mx-1">—</span>
            <EditableText value={exp.org} onChange={(v) => updateExperience(idx, "org", v)} placeholder="Entreprise" style={{ fontSize: toPx(baseFontSize + 0.5), color: primaryColor !== "#1a1a1a" ? primaryColor : undefined }} />
          </div>
          <EditableText value={exp.date} onChange={(v) => updateExperience(idx, "date", v)} placeholder="Date" className="text-zinc-500 font-medium shrink-0" style={{ fontSize: toPx(baseFontSize - 1) }} />
        </div>
        <ul className="flex flex-col gap-0.5 mt-1 list-none pl-0">
          {exp.bullets.map((bullet, bulletIdx) => (
            <li key={bulletIdx} className="group/bullet flex items-start gap-1.5 relative text-justify">
              <span className="font-bold select-none shrink-0" style={{ color: primaryColor, fontSize: toPx(baseFontSize) }}>•</span>
              <EditableText
                value={bullet}
                onChange={(v) => {
                  const next = [...exp.bullets];
                  next[bulletIdx] = v;
                  updateBullets(idx, next);
                }}
                className="text-zinc-700 flex-1 leading-relaxed"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                multiline
              />
              <button
                type="button"
                onClick={() => updateBullets(idx, exp.bullets.filter((_, i) => i !== bulletIdx))}
                className="opacity-0 group-hover/bullet:opacity-100 absolute -right-5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-30 transition-opacity"
                title="Supprimer"
              >
                <Trash2 size={10} />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => updateBullets(idx, [...exp.bullets, "Nouvelle mission..."])}
          className="opacity-0 group-hover/exp:opacity-100 flex items-center gap-1 mt-1 text-[9px] text-zinc-400 hover:text-primary transition-opacity self-start z-30"
        >
          <PlusCircle size={10} /> Ajouter une puce
        </button>
      </div>
    );
  }

  if (blockId.startsWith("project_")) {
    const idx = parseInt(blockId.split("_")[1]);
    const proj = data.projects[idx];
    if (!proj) return null;
    return (
      <div className="flex flex-col w-full text-left">
        <EditableText value={proj.title} onChange={(v) => updateProject(idx, "title", v)} className="font-bold text-zinc-950 leading-snug" style={{ fontSize: toPx(baseFontSize + 0.5) }} placeholder="Nom du projet" />
        <EditableText value={proj.description} onChange={(v) => updateProject(idx, "description", v)} className="text-zinc-700 text-justify leading-relaxed mt-0.5" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} multiline placeholder="Description..." />
        {proj.stack && (
          <div className="text-zinc-500 mt-0.5" style={{ fontSize: toPx(baseFontSize - 0.5) }}>
            <span className="font-bold text-zinc-800">Stack: </span>
            <EditableText value={proj.stack} onChange={(v) => updateProject(idx, "stack", v)} placeholder="React, Node..." className="italic" />
          </div>
        )}
      </div>
    );
  }

  if (blockId === "content_certifications") {
    return <EditableText value={personalInfo.certifications ?? ""} onChange={(v) => updatePersonalInfo("certifications", v)} className="text-zinc-800 w-full text-left" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} multiline placeholder="Certification 1, Certification 2..." />;
  }

  if (blockId === "content_interests") {
    return <EditableText value={personalInfo.interests ?? ""} onChange={(v) => updatePersonalInfo("interests", v)} className="text-zinc-800 w-full text-left" style={{ fontSize: toPx(baseFontSize), lineHeight: lh }} multiline placeholder="Lecture · Voyages · Sport..." />;
  }

  return null;
}
