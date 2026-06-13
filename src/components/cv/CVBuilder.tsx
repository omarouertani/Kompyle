"use client";

import React, { useState } from "react";
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
          {title || "Nouvel élément"}
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
            title="Dupliquer"
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
            title="Supprimer"
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
        <SectionHeading icon={User}>Informations Personnelles</SectionHeading>
        <div className="grid grid-cols-2 gap-5">
          <Field label="Nom complet" value={data.personalInfo.name} onChange={(v) => updatePersonalInfo("name", v)} />
          <Field label="Titre" value={data.personalInfo.role} onChange={(v) => updatePersonalInfo("role", v)} />
          <Field label="Technologies clés (sous-titre)" value={data.personalInfo.techLine} onChange={(v) => updatePersonalInfo("techLine", v)} className="col-span-2" />
          <Field label="Résumé professionnel" value={data.personalInfo.summary} onChange={(v) => updatePersonalInfo("summary", v)} multiline rows={4} className="col-span-2" />
          <Field label="Email" value={data.personalInfo.email} onChange={(v) => updatePersonalInfo("email", v)} />
          <Field label="Téléphone" value={data.personalInfo.phone} onChange={(v) => updatePersonalInfo("phone", v)} />
          <Field label="Localisation" value={data.personalInfo.location} onChange={(v) => updatePersonalInfo("location", v)} />
          <Field label="LinkedIn (URL)" value={data.personalInfo.linkedin} onChange={(v) => updatePersonalInfo("linkedin", v)} />
          <Field label="Portfolio (URL, optionnel)" value={data.personalInfo.portfolio ?? ""} onChange={(v) => updatePersonalInfo("portfolio", v)} className="col-span-2" />

          {/* Uploader de photo de profil */}
          <div className="flex flex-col gap-2 col-span-2 border border-border/60 rounded-lg p-3 bg-muted/10 mt-1">
            <Label className="font-semibold text-xs text-muted-foreground uppercase">Photo de profil</Label>
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
                    Supprimer
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
                  Choisir une photo
                </Button>
                <p className="text-[10px] text-muted-foreground">Format PNG ou JPG recommandé.</p>
              </div>
            </div>
          </div>

          <Field label="Date de naissance" value={data.personalInfo.birthDate ?? ""} onChange={(v) => updatePersonalInfo("birthDate", v)} placeholder="ex : 10/02/2001" />
          <Field label="Certifications (séparées par des virgules)" value={data.personalInfo.certifications ?? ""} onChange={(v) => updatePersonalInfo("certifications", v)} placeholder="ex : CCNA 1, CCNA 2, ITIL" className="col-span-2" />
          <Field label="Centres d'intérêt (séparés par des points · ou virgules)" value={data.personalInfo.interests ?? ""} onChange={(v) => updatePersonalInfo("interests", v)} placeholder="ex : Peinture Amatrice · Passion pour la lecture" className="col-span-2" />
        </div>
      </section>

      {/* ── Compétences ── */}
      <SortableSection
        icon={Lightbulb}
        heading="Compétences"
        items={data.skills}
        getTitle={(g) => g.category}
        addLabel="Ajouter une catégorie"
        onAdd={() => setSection("skills", [...data.skills, { id: uuidv4(), category: "", items: "" } satisfies SkillGroup])}
        onReorder={(items) => setSection("skills", items)}
        onRemove={removeItem("skills")}
        onDuplicate={duplicateItem("skills")}
        renderFields={(group) => (
          <>
            <Field label="Catégorie" value={group.category} onChange={(v) => updateItem("skills", group.id!, { category: v })} />
            <Field label="Compétences (séparées par des virgules)" value={group.items} onChange={(v) => updateItem("skills", group.id!, { items: v })} multiline rows={2} />
          </>
        )}
      />

      {/* ── Langues ── */}
      <section>
        <SectionHeading icon={Languages}>Langues</SectionHeading>
        <div className="flex flex-col gap-3 mb-5">
          {data.spokenLanguages.map((lang, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input
                className="flex-1"
                value={lang}
                placeholder="ex : Français (natif)"
                onChange={(e) => updateLanguage(i, e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => onChange({ ...data, spokenLanguages: data.spokenLanguages.filter((_, idx) => idx !== i) })}
                title="Supprimer"
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
          <Plus size={15} /> Ajouter une langue
        </Button>
      </section>

      {/* ── Expériences ── */}
      <SortableSection
        icon={Briefcase}
        heading="Expériences"
        items={data.experiences}
        getTitle={(e) => e.title}
        addLabel="Ajouter une expérience"
        onAdd={() => setSection("experiences", [...data.experiences, { id: uuidv4(), title: "", org: "", date: "", bullets: [] } satisfies Experience])}
        onReorder={(items) => setSection("experiences", items)}
        onRemove={removeItem("experiences")}
        onDuplicate={duplicateItem("experiences")}
        renderFields={(exp) => (
          <>
            <Field label="Titre du poste" value={exp.title} onChange={(v) => updateItem("experiences", exp.id!, { title: v })} />
            <Field label="Entreprise" value={exp.org} onChange={(v) => updateItem("experiences", exp.id!, { org: v })} />
            <Field label="Dates" value={exp.date} onChange={(v) => updateItem("experiences", exp.id!, { date: v })} />
            <Field
              label="Missions & Réalisations (1 par ligne)"
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
        heading="Projets"
        items={data.projects}
        getTitle={(p) => p.title}
        addLabel="Ajouter un projet"
        onAdd={() => setSection("projects", [...data.projects, { id: uuidv4(), title: "", description: "", stack: "" } satisfies Project])}
        onReorder={(items) => setSection("projects", items)}
        onRemove={removeItem("projects")}
        onDuplicate={duplicateItem("projects")}
        renderFields={(proj) => (
          <>
            <Field label="Nom du projet" value={proj.title} onChange={(v) => updateItem("projects", proj.id!, { title: v })} />
            <Field label="Description" value={proj.description} onChange={(v) => updateItem("projects", proj.id!, { description: v })} multiline rows={4} />
            <Field label="Stack Technique" value={proj.stack || ""} onChange={(v) => updateItem("projects", proj.id!, { stack: v })} />
          </>
        )}
      />

      {/* ── Formations ── */}
      <SortableSection
        icon={GraduationCap}
        heading="Formations"
        items={data.education}
        getTitle={(e) => e.degree}
        addLabel="Ajouter une formation"
        onAdd={() => setSection("education", [...data.education, { id: uuidv4(), degree: "", institution: "" } satisfies Education])}
        onReorder={(items) => setSection("education", items)}
        onRemove={removeItem("education")}
        onDuplicate={duplicateItem("education")}
        renderFields={(edu) => (
          <>
            <Field label="Diplôme" value={edu.degree} onChange={(v) => updateItem("education", edu.id!, { degree: v })} />
            <Field label="Institution" value={edu.institution} onChange={(v) => updateItem("education", edu.id!, { institution: v })} />
            <Field label="Date" value={edu.date ?? ""} onChange={(v) => updateItem("education", edu.id!, { date: v })} />
          </>
        )}
      />
    </div>
  );
}
