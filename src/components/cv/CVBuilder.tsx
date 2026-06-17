"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from "uuid";
import type { CVData, Experience, Project, Education, SkillGroup } from "@/types/cv";
import { stripHtml } from "@/utils/strip-html";
import LayoutManager from "./LayoutManager";
import {
  User,
  Briefcase,
  Rocket,
  GraduationCap,
  Lightbulb,
  Languages,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Copy,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ExperienceDatePicker } from "./ExperienceDatePicker";

interface CVBuilderProps {
  data: CVData;
  onChange: (newData: CVData) => void;
}

type ListSection = "skills" | "experiences" | "projects" | "education";

/* ── Champ avec label (évite la répétition Label+Input partout) ── */
function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="resize-y" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 text-base font-semibold text-foreground mb-5 pb-2.5 border-b border-border">
      <Icon size={18} className="text-primary" />
      {children}
    </h2>
  );
}

function SortableItem({
  id,
  title,
  onDelete,
  onDuplicate,
  children,
}: {
  id: string;
  title: string;
  onDelete: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("Builder");
  // Un élément fraîchement ajouté (titre vide) s'ouvre directement pour la saisie.
  const [isOpen, setIsOpen] = useState(() => title.trim() === "");
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  return (
    <Card ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="mb-2.5 overflow-hidden">
      <div className="flex items-center px-3.5 py-2.5 bg-muted/30 group hover:bg-muted/50 transition-colors">
        <div className="cursor-grab text-muted-foreground/50 mr-2.5 group-hover:text-muted-foreground transition-colors" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
        <div className="flex-1 font-medium text-sm cursor-pointer select-none text-foreground truncate" onClick={() => setIsOpen(!isOpen)}>
          {title || t("item_new")}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            title={t("duplicate")}
          >
            <Copy size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title={t("delete")}
          >
            <Trash2 size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>
      </div>
      {isOpen && <CardContent className="p-5 border-t border-border bg-card flex flex-col gap-5">{children}</CardContent>}
    </Card>
  );
}

/* ── Section triable générique : drag-and-drop + suppression + ajout ── */
function SortableSection<T extends { id?: string }>({
  icon,
  heading,
  items,
  getTitle,
  addLabel,
  onAdd,
  onReorder,
  onRemove,
  onDuplicate,
  renderFields,
}: {
  icon: React.ElementType;
  heading: string;
  items: T[];
  getTitle: (item: T) => string;
  addLabel: string;
  onAdd: () => void;
  onReorder: (items: T[]) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  renderFields: (item: T) => React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <section>
      <SectionHeading icon={icon}>{heading}</SectionHeading>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id!)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItem key={item.id} id={item.id!} title={getTitle(item)} onDelete={() => onRemove(item.id!)} onDuplicate={() => onDuplicate(item.id!)}>
              {renderFields(item)}
            </SortableItem>
          ))}
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        className="w-full mt-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border gap-2"
        onClick={onAdd}
      >
        <Plus size={15} /> {addLabel}
      </Button>
    </section>
  );
}

export default function CVBuilder({ data, onChange }: CVBuilderProps) {
  const t = useTranslations("Builder");
  const setSection = <T,>(section: ListSection, items: T[]) =>
    onChange({ ...data, [section]: items });

  const updateItem = (section: ListSection, id: string, updates: Record<string, unknown>) => {
    const items = data[section] as { id?: string }[];
    setSection(section, items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const removeItem = (section: ListSection) => (id: string) => {
    const items = data[section] as { id?: string }[];
    setSection(section, items.filter((item) => item.id !== id));
  };

  /** Duplique un élément juste après l'original (avec un nouvel id). */
  const duplicateItem = (section: ListSection) => (id: string) => {
    const items = data[section] as { id?: string }[];
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return;
    const copy = { ...items[idx], id: uuidv4() };
    setSection(section, [...items.slice(0, idx + 1), copy, ...items.slice(idx + 1)]);
  };

  const updatePersonalInfo = (field: string, value: string) =>
    onChange({ ...data, personalInfo: { ...data.personalInfo, [field]: value } });

  const updateLanguage = (index: number, value: string) => {
    const next = [...data.spokenLanguages];
    next[index] = value;
    onChange({ ...data, spokenLanguages: next });
  };

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* ── Mise en page (sections) ── */}
      <LayoutManager data={data} onChange={onChange} />

      {/* ── Informations Personnelles ── */}
      <section>
        <SectionHeading icon={User}>{t("section_personal")}</SectionHeading>
        <div className="grid grid-cols-2 gap-5">
          {/* Éditeur structuré = texte brut. On retire le HTML inline qu'un style
              appliqué sur le canvas aurait pu injecter dans ces champs. */}
          <Field label={t("field_name")} value={stripHtml(data.personalInfo.name)} onChange={(v) => updatePersonalInfo("name", v)} />
          <Field label={t("field_role")} value={stripHtml(data.personalInfo.role)} onChange={(v) => updatePersonalInfo("role", v)} />
          <Field label={t("field_techline")} value={stripHtml(data.personalInfo.techLine)} onChange={(v) => updatePersonalInfo("techLine", v)} className="col-span-2" />
          <Field label={t("field_summary")} value={stripHtml(data.personalInfo.summary)} onChange={(v) => updatePersonalInfo("summary", v)} multiline rows={4} className="col-span-2" />
          <Field label={t("field_email")} value={stripHtml(data.personalInfo.email)} onChange={(v) => updatePersonalInfo("email", v)} />
          <Field label={t("field_phone")} value={stripHtml(data.personalInfo.phone)} onChange={(v) => updatePersonalInfo("phone", v)} />
          <Field label={t("field_location")} value={stripHtml(data.personalInfo.location)} onChange={(v) => updatePersonalInfo("location", v)} />
          <Field label={t("field_linkedin")} value={stripHtml(data.personalInfo.linkedin)} onChange={(v) => updatePersonalInfo("linkedin", v)} />
          <Field label={t("field_portfolio")} value={stripHtml(data.personalInfo.portfolio ?? "")} onChange={(v) => updatePersonalInfo("portfolio", v)} className="col-span-2" />

          {/* Uploader de photo de profil */}
          <div className="flex flex-col gap-2 col-span-2 border border-border/60 rounded-lg p-3 bg-muted/10 mt-1">
            <Label className="font-semibold text-xs text-muted-foreground uppercase">{t("photo_label")}</Label>
            <div className="flex items-center gap-4 mt-1">
              {data.personalInfo.photo ? (
                <div className="relative size-14 rounded-full overflow-hidden border border-border bg-card shadow-sm shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL, next/image inadapté */}
                  <img src={data.personalInfo.photo} alt="Avatar" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => updatePersonalInfo("photo", "")}
                    className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-medium"
                  >
                    {t("photo_remove")}
                  </button>
                </div>
              ) : (
                <div className="size-14 rounded-full border border-dashed border-border/80 bg-muted/30 flex items-center justify-center text-muted-foreground/40 shrink-0">
                  <User size={20} />
                </div>
              )}
              <div className="flex flex-col gap-1.5 flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => updatePersonalInfo("photo", reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                  id="avatar-upload-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => document.getElementById("avatar-upload-input")?.click()}
                >
                  {t("photo_choose")}
                </Button>
                <p className="text-[10px] text-muted-foreground">{t("photo_hint")}</p>
              </div>
            </div>
          </div>

          <Field label={t("field_birthdate")} value={data.personalInfo.birthDate ?? ""} onChange={(v) => updatePersonalInfo("birthDate", v)} placeholder={t("field_birthdate_ph")} />
          <Field label={t("field_certifications")} value={data.personalInfo.certifications ?? ""} onChange={(v) => updatePersonalInfo("certifications", v)} placeholder={t("field_certifications_ph")} className="col-span-2" />
          <Field label={t("field_interests")} value={data.personalInfo.interests ?? ""} onChange={(v) => updatePersonalInfo("interests", v)} placeholder={t("field_interests_ph")} className="col-span-2" />
        </div>
      </section>

      {/* ── Compétences ── */}
      <SortableSection
        icon={Lightbulb}
        heading={t("section_skills")}
        items={data.skills}
        getTitle={(g) => g.category}
        addLabel={t("add_skill")}
        onAdd={() => setSection("skills", [...data.skills, { id: uuidv4(), category: "", items: "" } satisfies SkillGroup])}
        onReorder={(items) => setSection("skills", items)}
        onRemove={removeItem("skills")}
        onDuplicate={duplicateItem("skills")}
        renderFields={(group) => (
          <>
            <Field label={t("field_category")} value={group.category} onChange={(v) => updateItem("skills", group.id!, { category: v })} />
            <Field label={t("field_skill_items")} value={group.items} onChange={(v) => updateItem("skills", group.id!, { items: v })} multiline rows={2} />
          </>
        )}
      />

      {/* ── Langues ── */}
      <section>
        <SectionHeading icon={Languages}>{t("section_languages")}</SectionHeading>
        <div className="flex flex-col gap-3 mb-5">
          {data.spokenLanguages.map((lang, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                className="flex-1"
                value={lang}
                placeholder={t("lang_placeholder")}
                onChange={(e) => updateLanguage(i, e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => onChange({ ...data, spokenLanguages: data.spokenLanguages.filter((_, idx) => idx !== i) })}
                title={t("delete")}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border gap-2"
          onClick={() => onChange({ ...data, spokenLanguages: [...data.spokenLanguages, ""] })}
        >
          <Plus size={15} /> {t("add_language")}
        </Button>
      </section>

      {/* ── Expériences ── */}
      <SortableSection
        icon={Briefcase}
        heading={t("section_experiences")}
        items={data.experiences}
        getTitle={(e) => e.title}
        addLabel={t("add_experience")}
        onAdd={() => setSection("experiences", [...data.experiences, { id: uuidv4(), title: "", org: "", date: "", bullets: [] } satisfies Experience])}
        onReorder={(items) => setSection("experiences", items)}
        onRemove={removeItem("experiences")}
        onDuplicate={duplicateItem("experiences")}
        renderFields={(exp) => (
          <>
            <Field label={t("field_exp_title")} value={exp.title} onChange={(v) => updateItem("experiences", exp.id!, { title: v })} />
            <Field label={t("field_exp_org")} value={exp.org} onChange={(v) => updateItem("experiences", exp.id!, { org: v })} />
            <div className="flex flex-col gap-2">
              <Label>{t("field_exp_date")}</Label>
              <ExperienceDatePicker
                value={exp.date}
                onChange={(v) => updateItem("experiences", exp.id!, { date: v })}
                withIcon
                triggerClassName="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm hover:bg-input/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <Field
              label={t("field_exp_bullets")}
              value={exp.bullets.join("\n")}
              onChange={(v) => updateItem("experiences", exp.id!, { bullets: v.split("\n").filter((b) => b.trim() !== "") })}
              multiline
              rows={6}
            />
          </>
        )}
      />

      {/* ── Projets ── */}
      <SortableSection
        icon={Rocket}
        heading={t("section_projects")}
        items={data.projects}
        getTitle={(p) => p.title}
        addLabel={t("add_project")}
        onAdd={() => setSection("projects", [...data.projects, { id: uuidv4(), title: "", description: "", stack: "" } satisfies Project])}
        onReorder={(items) => setSection("projects", items)}
        onRemove={removeItem("projects")}
        onDuplicate={duplicateItem("projects")}
        renderFields={(proj) => (
          <>
            <Field label={t("field_proj_title")} value={proj.title} onChange={(v) => updateItem("projects", proj.id!, { title: v })} />
            <Field label={t("field_proj_desc")} value={proj.description} onChange={(v) => updateItem("projects", proj.id!, { description: v })} multiline rows={4} />
            <Field label={t("field_proj_stack")} value={proj.stack || ""} onChange={(v) => updateItem("projects", proj.id!, { stack: v })} />
          </>
        )}
      />

      {/* ── Formations ── */}
      <SortableSection
        icon={GraduationCap}
        heading={t("section_education")}
        items={data.education}
        getTitle={(e) => e.degree}
        addLabel={t("add_education")}
        onAdd={() => setSection("education", [...data.education, { id: uuidv4(), degree: "", institution: "" } satisfies Education])}
        onReorder={(items) => setSection("education", items)}
        onRemove={removeItem("education")}
        onDuplicate={duplicateItem("education")}
        renderFields={(edu) => (
          <>
            <Field label={t("field_edu_degree")} value={edu.degree} onChange={(v) => updateItem("education", edu.id!, { degree: v })} />
            <Field label={t("field_edu_institution")} value={edu.institution} onChange={(v) => updateItem("education", edu.id!, { institution: v })} />
            <Field label={t("field_edu_date")} value={edu.date ?? ""} onChange={(v) => updateItem("education", edu.id!, { date: v })} />
          </>
        )}
      />
    </div>
  );
}
