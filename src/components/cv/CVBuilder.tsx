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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

interface CVBuilderProps {
  data: CVData;
  onChange: (newData: CVData) => void;
}

type ListSection = "skills" | "experiences" | "projects" | "education";

const newExperience = (): Experience => ({ id: uuidv4(), title: "", org: "", date: "", bullets: [] });
const newProject = (): Project => ({ id: uuidv4(), title: "", description: "", stack: "" });
const newEducation = (): Education => ({ id: uuidv4(), degree: "", institution: "" });
const newSkill = (): SkillGroup => ({ id: uuidv4(), category: "", items: "" });

/* ── Section heading component for consistent styling ── */
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
  children,
}: {
  id: string;
  title: string;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className="mb-2.5 overflow-hidden">
      <div className="flex items-center px-3.5 py-2.5 bg-muted/30 group hover:bg-muted/50 transition-colors">
        <div className="cursor-grab text-muted-foreground/50 mr-2.5 group-hover:text-muted-foreground transition-colors" {...attributes} {...listeners}>
          <GripVertical size={16} />
        </div>
        <div className="flex-1 font-medium text-sm cursor-pointer select-none text-foreground truncate" onClick={() => setIsOpen(!isOpen)}>
          {title || "Nouvel élément"}
        </div>
        <div className="flex items-center gap-0.5">
          {onDelete && (
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
          )}
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>
      </div>
      {isOpen && <CardContent className="p-5 border-t border-border bg-card flex flex-col gap-5">{children}</CardContent>}
    </Card>
  );
}

export default function CVBuilder({ data, onChange }: CVBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent, section: ListSection) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const items = data[section] as { id?: string }[];
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);

      onChange({
        ...data,
        [section]: arrayMove(items, oldIndex, newIndex),
      });
    }
  };

  const updateItem = (section: ListSection, id: string, updates: Record<string, unknown>) => {
    const items = data[section] as { id?: string }[];
    onChange({
      ...data,
      [section]: items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    });
  };

  const addItem = (section: ListSection, item: Experience | Project | Education | SkillGroup) => {
    const items = data[section] as unknown[];
    onChange({ ...data, [section]: [...items, item] });
  };

  const removeItem = (section: ListSection, id: string) => {
    const items = data[section] as { id?: string }[];
    onChange({ ...data, [section]: items.filter((item) => item.id !== id) });
  };

  const updatePersonalInfo = (field: string, value: string) => {
    onChange({
      ...data,
      personalInfo: { ...data.personalInfo, [field]: value },
    });
  };

  const updateLanguage = (index: number, value: string) => {
    const next = [...data.spokenLanguages];
    next[index] = value;
    onChange({ ...data, spokenLanguages: next });
  };
  const addLanguage = () => onChange({ ...data, spokenLanguages: [...data.spokenLanguages, ""] });
  const removeLanguage = (index: number) =>
    onChange({ ...data, spokenLanguages: data.spokenLanguages.filter((_, i) => i !== index) });

  return (
    <div className="flex flex-col gap-12 pb-12">
      {/* ── Mise en page (sections) ── */}
      <LayoutManager data={data} onChange={onChange} />

      {/* ── Informations Personnelles ── */}
      <section>
        <SectionHeading icon={User}>Informations Personnelles</SectionHeading>
        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Label>Nom complet</Label>
            <Input
              value={data.personalInfo.name}
              onChange={(e) => updatePersonalInfo("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Titre</Label>
            <Input
              value={data.personalInfo.role}
              onChange={(e) => updatePersonalInfo("role", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-2">
            <Label>Technologies clés (sous-titre)</Label>
            <Input
              value={data.personalInfo.techLine}
              onChange={(e) => updatePersonalInfo("techLine", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-2">
            <Label>Résumé professionnel</Label>
            <Textarea
              value={data.personalInfo.summary}
              onChange={(e) => updatePersonalInfo("summary", e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Email</Label>
            <Input
              value={data.personalInfo.email}
              onChange={(e) => updatePersonalInfo("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Téléphone</Label>
            <Input
              value={data.personalInfo.phone}
              onChange={(e) => updatePersonalInfo("phone", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Localisation</Label>
            <Input
              value={data.personalInfo.location}
              onChange={(e) => updatePersonalInfo("location", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>LinkedIn (URL)</Label>
            <Input
              value={data.personalInfo.linkedin}
              onChange={(e) => updatePersonalInfo("linkedin", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2 col-span-2">
            <Label>Portfolio (URL, optionnel)</Label>
            <Input
              value={data.personalInfo.portfolio ?? ""}
              onChange={(e) => updatePersonalInfo("portfolio", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Compétences ── */}
      <section>
        <SectionHeading icon={Lightbulb}>Compétences</SectionHeading>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, "skills")}
        >
          <SortableContext
            items={data.skills.map((s) => s.id!)}
            strategy={verticalListSortingStrategy}
          >
            {data.skills.map((group) => (
              <SortableItem
                key={group.id}
                id={group.id!}
                title={group.category}
                onDelete={() => removeItem("skills", group.id!)}
              >
                <div className="flex flex-col gap-2">
                  <Label>Catégorie</Label>
                  <Input
                    value={group.category}
                    onChange={(e) => updateItem("skills", group.id!, { category: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Compétences (séparées par des virgules)</Label>
                  <Textarea
                    value={group.items}
                    onChange={(e) => updateItem("skills", group.id!, { items: e.target.value })}
                    rows={2}
                    className="resize-y"
                  />
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <Button
          variant="outline"
          className="w-full mt-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border gap-2"
          onClick={() => addItem("skills", newSkill())}
        >
          <Plus size={15} /> Ajouter une catégorie
        </Button>
      </section>

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
                onClick={() => removeLanguage(i)}
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
          onClick={addLanguage}
        >
          <Plus size={15} /> Ajouter une langue
        </Button>
      </section>

      {/* ── Expériences ── */}
      <section>
        <SectionHeading icon={Briefcase}>Expériences</SectionHeading>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, "experiences")}
        >
          <SortableContext
            items={data.experiences.map((e) => e.id!)}
            strategy={verticalListSortingStrategy}
          >
            {data.experiences.map((exp) => (
              <SortableItem
                key={exp.id}
                id={exp.id!}
                title={exp.title}
                onDelete={() => removeItem("experiences", exp.id!)}
              >
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`force-break-exp-${exp.id}`}
                      checked={exp.forcePageBreak || false}
                      onCheckedChange={(checked) =>
                        updateItem("experiences", exp.id!, { forcePageBreak: checked === true })
                      }
                    />
                    <Label htmlFor={`force-break-exp-${exp.id}`} className="cursor-pointer text-sm">Forcer saut de page avant</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Marge basse (pt) :</Label>
                    <Input
                      type="number"
                      className="w-20 h-8 text-sm"
                      min="0"
                      max="50"
                      value={exp.customMarginBottom ?? ""}
                      placeholder="Auto"
                      onChange={(e) =>
                        updateItem("experiences", exp.id!, {
                          customMarginBottom: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Label>Titre du poste</Label>
                  <Input
                    value={exp.title}
                    onChange={(e) => updateItem("experiences", exp.id!, { title: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Entreprise</Label>
                  <Input
                    value={exp.org}
                    onChange={(e) => updateItem("experiences", exp.id!, { org: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Dates</Label>
                  <Input
                    value={exp.date}
                    onChange={(e) => updateItem("experiences", exp.id!, { date: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Missions & Réalisations (1 par ligne)</Label>
                  <Textarea
                    value={exp.bullets.join("\n")}
                    onChange={(e) =>
                      updateItem("experiences", exp.id!, {
                        bullets: e.target.value.split("\n").filter((b) => b.trim() !== ""),
                      })
                    }
                    rows={6}
                    className="resize-y"
                  />
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <Button
          variant="outline"
          className="w-full mt-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border gap-2"
          onClick={() => addItem("experiences", newExperience())}
        >
          <Plus size={15} /> Ajouter une expérience
        </Button>
      </section>

      {/* ── Projets ── */}
      <section>
        <SectionHeading icon={Rocket}>Projets</SectionHeading>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, "projects")}
        >
          <SortableContext
            items={data.projects.map((p) => p.id!)}
            strategy={verticalListSortingStrategy}
          >
            {data.projects.map((proj) => (
              <SortableItem
                key={proj.id}
                id={proj.id!}
                title={proj.title}
                onDelete={() => removeItem("projects", proj.id!)}
              >
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`force-break-proj-${proj.id}`}
                      checked={proj.forcePageBreak || false}
                      onCheckedChange={(checked) =>
                        updateItem("projects", proj.id!, { forcePageBreak: checked === true })
                      }
                    />
                    <Label htmlFor={`force-break-proj-${proj.id}`} className="cursor-pointer text-sm">Forcer saut de page avant</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Marge basse (pt) :</Label>
                    <Input
                      type="number"
                      className="w-20 h-8 text-sm"
                      min="0"
                      max="50"
                      value={proj.customMarginBottom ?? ""}
                      placeholder="Auto"
                      onChange={(e) =>
                        updateItem("projects", proj.id!, {
                          customMarginBottom: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Nom du projet</Label>
                  <Input
                    value={proj.title}
                    onChange={(e) => updateItem("projects", proj.id!, { title: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Description</Label>
                  <Textarea
                    value={proj.description}
                    onChange={(e) => updateItem("projects", proj.id!, { description: e.target.value })}
                    rows={4}
                    className="resize-y"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Stack Technique</Label>
                  <Input
                    value={proj.stack || ""}
                    onChange={(e) => updateItem("projects", proj.id!, { stack: e.target.value })}
                  />
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <Button
          variant="outline"
          className="w-full mt-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border gap-2"
          onClick={() => addItem("projects", newProject())}
        >
          <Plus size={15} /> Ajouter un projet
        </Button>
      </section>

      {/* ── Formations ── */}
      <section>
        <SectionHeading icon={GraduationCap}>Formations</SectionHeading>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, "education")}
        >
          <SortableContext
            items={data.education.map((e) => e.id!)}
            strategy={verticalListSortingStrategy}
          >
            {data.education.map((edu) => (
              <SortableItem
                key={edu.id}
                id={edu.id!}
                title={edu.degree}
                onDelete={() => removeItem("education", edu.id!)}
              >
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`force-break-edu-${edu.id}`}
                      checked={edu.forcePageBreak || false}
                      onCheckedChange={(checked) =>
                        updateItem("education", edu.id!, { forcePageBreak: checked === true })
                      }
                    />
                    <Label htmlFor={`force-break-edu-${edu.id}`} className="cursor-pointer text-sm">Forcer saut de page avant</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Marge basse (pt) :</Label>
                    <Input
                      type="number"
                      className="w-20 h-8 text-sm"
                      min="0"
                      max="50"
                      value={edu.customMarginBottom ?? ""}
                      placeholder="Auto"
                      onChange={(e) =>
                        updateItem("education", edu.id!, {
                          customMarginBottom: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Diplôme</Label>
                  <Input
                    value={edu.degree}
                    onChange={(e) => updateItem("education", edu.id!, { degree: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Institution</Label>
                  <Input
                    value={edu.institution}
                    onChange={(e) => updateItem("education", edu.id!, { institution: e.target.value })}
                  />
                </div>
              </SortableItem>
            ))}
          </SortableContext>
        </DndContext>
        <Button
          variant="outline"
          className="w-full mt-2 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-border gap-2"
          onClick={() => addItem("education", newEducation())}
        >
          <Plus size={15} /> Ajouter une formation
        </Button>
      </section>
    </div>
  );
}
