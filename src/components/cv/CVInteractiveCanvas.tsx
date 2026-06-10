"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { CVData, CVTheme, Experience, Project, Education, SkillGroup, SectionId } from "@/types/cv";
import { defaultLayout, emptyLayoutPage, ALL_SECTION_IDS, getDefaultPositions, getDefaultPhotoPosition, estimateAbsolutePageHeightPt, getSectionBlockIds, getParentSectionId } from "@/lib/cv-layout";
import { cn } from "@/lib/utils";
import {
  CVPageScaleWrapper,
  EditableText,
  PT_TO_PX,
  ptsToPx,
  measureBlockPositionsFromDOM,
} from "./cv-canvas-primitives";
import {
  GripVertical,
  ArrowLeftRight,
  EyeOff,
  Plus,
  Minus,
  Trash2,
  PlusCircle,
  Sparkles,
  FilePlus,
} from "lucide-react";
import { CanvasSectionHeading } from "./canvas-section-heading";

interface CVInteractiveCanvasProps {
  data: CVData;
  onChange: (newData: CVData) => void;
  template: "default" | "chaima";
  originalData?: CVData | null;
}

export default function CVInteractiveCanvas({
  data,
  onChange,
  template,
  originalData,
}: CVInteractiveCanvasProps) {
  const layout = data.layout ?? defaultLayout();
  const theme = layout.theme ?? {};
  const isChaima = template === "chaima";

  const primaryColor = theme.primaryColor || (isChaima ? "#fbbf24" : "#1a1a1a");
  const textColor = theme.textColor || "#27272a";
  const sidebarBg = theme.sidebarBg || (isChaima ? "#f4f4f5" : "transparent");
  const sidebarWidth = layout.sidebarWidth ?? (isChaima ? 175 : 165);

  const baseFontSize = theme.fontSize ?? (isChaima ? 9.5 : 10);
  const headingFontSize = theme.headingSize ?? 12;
  const sectionMarginBottom = theme.sectionMargin ?? (isChaima ? 12 : 5);
  const lh = theme.lineHeight ?? 1.2;

  const toPx = ptsToPx;

  const pagesKey = useMemo(
    () => layout.pages.map((p) => `${p.main.join(",")}|${p.sidebar.join(",")}`).join("||"),
    [layout.pages]
  );

  const defaultPositions = useMemo(
    () => getDefaultPositions(template, data),
    [template, data, layout.sidebarWidth, pagesKey]
  );

  const dataRef = useRef(data);
  const layoutRef = useRef(layout);
  const defaultPositionsRef = useRef(defaultPositions);
  const pageScaleRef = useRef(1);

  useEffect(() => {
    dataRef.current = data;
    layoutRef.current = layout;
    defaultPositionsRef.current = defaultPositions;
  }, [data, layout, defaultPositions]);

  const handleScaleChange = useCallback((scale: number) => {
    pageScaleRef.current = scale;
  }, []);

  const mouseDeltaToPts = useCallback((deltaPx: number) => {
    const scale = pageScaleRef.current || 1;
    return deltaPx / PT_TO_PX / scale;
  }, []);

  const [dragged, setDragged] = useState<{ id: string; pageIndex: number; col: "main" | "sidebar" } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pageIndex: number; col: "main" | "sidebar"; position: "before" | "after" } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activePageIndex, setActivePageIndex] = useState(0);

  useEffect(() => {
    if (activePageIndex >= layout.pages.length) {
      setActivePageIndex(Math.max(0, layout.pages.length - 1));
    }
  }, [layout.pages.length, activePageIndex]);

  useEffect(() => {
    const el = document.getElementById(`cv-page-${activePageIndex}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePageIndex]);

  // --- Inline Data Updates ---
  const updatePersonalInfo = (field: string, value: string) => {
    onChange({
      ...data,
      personalInfo: { ...data.personalInfo, [field]: value }
    });
  };

  const updateThemeValue = (updates: Partial<CVTheme>) => {
    onChange({
      ...data,
      layout: {
        ...layout,
        theme: {
          ...theme,
          ...updates
        }
      }
    });
  };

  const updateExperience = (index: number, field: keyof Experience, value: any) => {
    const next = [...data.experiences];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, experiences: next });
  };

  const updateExperienceBullet = (expIdx: number, bulletIdx: number, value: string) => {
    const next = [...data.experiences];
    const nextBullets = [...next[expIdx].bullets];
    nextBullets[bulletIdx] = value;
    next[expIdx] = { ...next[expIdx], bullets: nextBullets };
    onChange({ ...data, experiences: next });
  };

  const addExperienceBullet = (expIdx: number) => {
    const next = [...data.experiences];
    const nextBullets = [...next[expIdx].bullets, "Nouvelle mission..."];
    next[expIdx] = { ...next[expIdx], bullets: nextBullets };
    onChange({ ...data, experiences: next });
  };

  const removeExperienceBullet = (expIdx: number, bulletIdx: number) => {
    const next = [...data.experiences];
    const nextBullets = next[expIdx].bullets.filter((_, i) => i !== bulletIdx);
    next[expIdx] = { ...next[expIdx], bullets: nextBullets };
    onChange({ ...data, experiences: next });
  };

  const updateProject = (index: number, field: keyof Project, value: any) => {
    const next = [...data.projects];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, projects: next });
  };

  const updateEducation = (index: number, field: keyof Education, value: any) => {
    const next = [...data.education];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, education: next });
  };

  const updateSkillGroup = (index: number, field: keyof SkillGroup, value: string) => {
    const next = [...data.skills];
    next[index] = { ...next[index], [field]: value };
    onChange({ ...data, skills: next });
  };

  const updateLanguage = (index: number, value: string) => {
    const next = [...data.spokenLanguages];
    next[index] = value;
    onChange({ ...data, spokenLanguages: next });
  };

  // --- Drag and Drop Section Handlers ---
  const handleDragStart = (e: React.DragEvent, id: string, pageIndex: number, col: "main" | "sidebar") => {
    if (isResizing) {
      e.preventDefault();
      return;
    }
    setDragged({ id, pageIndex, col });
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string, pageIndex: number, col: "main" | "sidebar") => {
    e.preventDefault();
    if (!dragged || dragged.id === targetId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const position = mouseY < rect.height / 2 ? "before" : "after";

    setDropTarget({ id: targetId, pageIndex, col, position });
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string, targetPageIndex: number, targetCol: "main" | "sidebar") => {
    e.preventDefault();
    if (!dragged) return;

    const sourceId = dragged.id;
    const sourcePageIndex = dragged.pageIndex;
    const sourceCol = dragged.col;

    if (sourceId === targetId) {
      setDragged(null);
      setDropTarget(null);
      return;
    }

    const newPages = [...layout.pages];
    
    // Remove from source
    newPages[sourcePageIndex][sourceCol] = newPages[sourcePageIndex][sourceCol].filter(id => id !== sourceId);

    // Find target index
    const targetIndex = newPages[targetPageIndex][targetCol].indexOf(targetId);
    const insertIndex = dropTarget?.position === "after" ? targetIndex + 1 : targetIndex;

    // Insert into target
    newPages[targetPageIndex][targetCol].splice(insertIndex, 0, sourceId);

    onChange({
      ...data,
      layout: {
        ...layout,
        pages: newPages
      }
    });

    setDragged(null);
    setDropTarget(null);
  };

  const handleDropOnEmptyColumn = (e: React.DragEvent, targetPageIndex: number, targetCol: "main" | "sidebar") => {
    e.preventDefault();
    if (!dragged) return;

    const sourceId = dragged.id;
    const sourcePageIndex = dragged.pageIndex;
    const sourceCol = dragged.col;

    const newPages = [...layout.pages];
    newPages[sourcePageIndex][sourceCol] = newPages[sourcePageIndex][sourceCol].filter(id => id !== sourceId);
    newPages[targetPageIndex][targetCol].push(sourceId);

    onChange({
      ...data,
      layout: {
        ...layout,
        pages: newPages
      }
    });

    setDragged(null);
    setDropTarget(null);
  };

  const applyAbsolutePositionsFromDOM = useCallback(
    (currentLayout = layoutRef.current, enableAbsolute = true) => {
      const defaultPos = defaultPositionsRef.current;
      const nextPositions = measureBlockPositionsFromDOM(
        currentLayout.pages.length,
        defaultPos
      );

      onChange({
        ...dataRef.current,
        layout: {
          ...currentLayout,
          useAbsolutePositioning: enableAbsolute,
          absolutePositions: nextPositions,
        },
      });
    },
    [onChange]
  );

  const scheduleMeasureFromColumnLayout = useCallback(
    (currentLayout = layoutRef.current, enableAbsolute = true) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyAbsolutePositionsFromDOM(currentLayout, enableAbsolute);
        });
      });
    },
    [applyAbsolutePositionsFromDOM]
  );

  const enableAbsoluteMode = useCallback(() => {
    if (layoutRef.current.useAbsolutePositioning) return;
    scheduleMeasureFromColumnLayout(layoutRef.current, true);
  }, [scheduleMeasureFromColumnLayout]);

  const handleRealign = () => {
    const flowLayout = {
      ...layout,
      useAbsolutePositioning: false,
    };
    onChange({
      ...data,
      layout: flowLayout,
    });
    scheduleMeasureFromColumnLayout(flowLayout, true);
  };

  const addPage = () => {
    const nextPages = [...layout.pages, emptyLayoutPage()];
    onChange({
      ...data,
      layout: { ...layout, pages: nextPages },
    });
    setActivePageIndex(nextPages.length - 1);
  };

  const removePage = (pageIndex: number) => {
    if (layout.pages.length <= 1) return;
    const nextPages = layout.pages.filter((_, i) => i !== pageIndex);
    onChange({
      ...data,
      layout: { ...layout, pages: nextPages },
    });
    setActivePageIndex((prev) => Math.min(prev, nextPages.length - 1));
  };

  // --- Move Column, Move Page, Hide Handlers ---
  const handleMoveColumn = (pageIndex: number, col: "main" | "sidebar", id: string) => {
    const newPages = [...layout.pages];
    const page = newPages[pageIndex];
    page[col] = page[col].filter(s => s !== id);
    if (col === "main") {
      page.sidebar.push(id);
    } else {
      page.main.push(id);
    }
    onChange({
      ...data,
      layout: {
        ...layout,
        pages: newPages
      }
    });
  };

  const handleHideSection = (pageIndex: number, col: "main" | "sidebar", id: string) => {
    const newPages = [...layout.pages];
    newPages[pageIndex][col] = newPages[pageIndex][col].filter(s => s !== id);
    onChange({
      ...data,
      layout: {
        ...layout,
        pages: newPages
      }
    });
  };

  // --- Resize Mouse Down Handlers ---
  const handleSidebarResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPts = mouseDeltaToPts(moveEvent.clientX - startX);
      const nextWidth = Math.max(120, Math.min(300, Math.round(startWidth + deltaPts)));
      const current = dataRef.current;
      const currentLayout = layoutRef.current;

      onChange({
        ...current,
        layout: {
          ...currentLayout,
          sidebarWidth: nextWidth,
        },
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleSpacerMouseDown = (
    e: React.MouseEvent,
    type: "section" | "experience" | "project" | "education",
    targetId: string,
    currentMarginPts: number,
    itemIndex?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startY = e.clientY;
    const startMargin = currentMarginPts;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPts = mouseDeltaToPts(moveEvent.clientY - startY);
      const nextMargin = Math.max(0, Math.min(60, Math.round(startMargin + deltaPts)));
      const current = dataRef.current;
      const currentLayout = layoutRef.current;

      if (type === "section") {
        onChange({
          ...current,
          layout: {
            ...currentLayout,
            theme: { ...currentLayout.theme, sectionMargin: nextMargin },
          },
        });
      } else if (itemIndex !== undefined) {
        const sectionName =
          type === "experience" ? "experiences" : type === "project" ? "projects" : "education";
        const items = [...current[sectionName]];
        items[itemIndex] = { ...items[itemIndex], customMarginBottom: nextMargin };
        onChange({ ...current, [sectionName]: items });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleAbsoluteDragStart = (
    e: React.MouseEvent,
    id: string,
    currentPos: { x: number; y: number; w?: number }
  ) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("span[contenteditable]") || target.closest("input")) {
      return;
    }

    const blockEl = (e.currentTarget as HTMLElement);
    setIsResizing(true);
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = currentPos.x;
    const startY = currentPos.y;
    let pendingX = startX;
    let pendingY = startY;
    let rafId = 0;

    blockEl.style.willChange = "left, top";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const deltaX = mouseDeltaToPts(moveEvent.clientX - startMouseX);
        const deltaY = mouseDeltaToPts(moveEvent.clientY - startMouseY);

        const elementWidth = currentPos.w || 150;
        const maxValX = 595 - elementWidth;
        const maxValY = 820;

        pendingX = Math.max(0, Math.min(maxValX, Math.round(startX + deltaX)));
        pendingY = Math.max(0, Math.min(maxValY, Math.round(startY + deltaY)));

        blockEl.style.left = ptsToPx(pendingX);
        blockEl.style.top = ptsToPx(pendingY);
      });
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      blockEl.style.willChange = "";
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const current = dataRef.current;
      const currentLayout = layoutRef.current;
      const nextPositions = {
        ...(currentLayout.absolutePositions ?? defaultPositionsRef.current),
        [id]: { ...currentPos, x: pendingX, y: pendingY },
      };

      onChange({
        ...current,
        layout: { ...currentLayout, absolutePositions: nextPositions },
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleWidthResizeMouseDown = (
    e: React.MouseEvent,
    id: string,
    currentPos: { x: number; y: number; w?: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const blockEl = (e.currentTarget as HTMLElement).parentElement as HTMLElement | null;
    setIsResizing(true);
    const startMouseX = e.clientX;
    const startWidth = currentPos.w || (isChaima ? 175 : 165);
    let pendingWidth = startWidth;
    let rafId = 0;

    if (blockEl) blockEl.style.willChange = "width";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const deltaX = mouseDeltaToPts(moveEvent.clientX - startMouseX);
        pendingWidth = Math.max(80, Math.min(500, Math.round(startWidth + deltaX)));
        if (blockEl) blockEl.style.width = ptsToPx(pendingWidth);
      });
    };

    const handleMouseUp = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (blockEl) blockEl.style.willChange = "";
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      const current = dataRef.current;
      const currentLayout = layoutRef.current;
      const nextPositions = {
        ...(currentLayout.absolutePositions ?? defaultPositionsRef.current),
        [id]: { ...currentPos, w: pendingWidth },
      };

      onChange({
        ...current,
        layout: { ...currentLayout, absolutePositions: nextPositions },
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // --- Render Sections HTML ---
  const renderContactHtml = () => {
    const { personalInfo } = data;
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Contact" blockId="title_contact" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />
        
        <div className="flex flex-col gap-1" data-block-id="content_contact">
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">Email</span>
            <EditableText 
              value={personalInfo.email} 
              onChange={(v) => updatePersonalInfo("email", v)} 
              className="font-medium text-zinc-800 break-all"
              style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">Téléphone</span>
            <EditableText 
              value={personalInfo.phone} 
              onChange={(v) => updatePersonalInfo("phone", v)} 
              className="font-medium text-zinc-800"
              style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">Localisation</span>
            <EditableText 
              value={personalInfo.location} 
              onChange={(v) => updatePersonalInfo("location", v)} 
              className="font-medium text-zinc-800"
              style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500">LinkedIn</span>
            <EditableText 
              value={personalInfo.linkedin} 
              onChange={(v) => updatePersonalInfo("linkedin", v)} 
              className="font-medium text-zinc-800 break-all"
              style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
            />
          </div>
          {personalInfo.portfolio !== undefined && (
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500">Portfolio</span>
              <EditableText 
                value={personalInfo.portfolio} 
                onChange={(v) => updatePersonalInfo("portfolio", v)} 
                className="font-medium text-zinc-800 break-all"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSkillsHtml = () => {
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Compétences" blockId="title_skills" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

        <div className="flex flex-col gap-2">
          {data.skills.map((group, i) => (
            <div key={group.id ?? i} className="flex flex-col" data-block-id={`skill_${i}`}>
              <EditableText 
                value={group.category} 
                onChange={(v) => updateSkillGroup(i, "category", v)} 
                className="font-bold text-zinc-800"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                placeholder="Catégorie"
              />
              <EditableText 
                value={group.items} 
                onChange={(v) => updateSkillGroup(i, "items", v)} 
                className="text-zinc-600 mt-0.5"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                placeholder="Compétence 1, Compétence 2..."
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLanguagesHtml = () => {
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Langues" blockId="title_languages" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

        <div className="flex flex-col gap-1" data-block-id="content_languages">
          {data.spokenLanguages.map((lang, i) => (
            <EditableText 
              key={i}
              value={lang} 
              onChange={(v) => updateLanguage(i, v)} 
              className="text-zinc-800"
              style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
              placeholder="ex: Français (Natif)"
            />
          ))}
        </div>
      </div>
    );
  };

  const renderEducationHtml = () => {
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Formation" blockId="title_education" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

        <div className="flex flex-col gap-3">
          {data.education.map((edu, i) => (
            <div 
              key={edu.id ?? i} 
              className="flex flex-col group/edu relative"
              data-block-id={`education_${i}`}
              style={{ marginBottom: toPx(edu.customMarginBottom ?? 4) }}
            >
              <EditableText 
                value={edu.degree} 
                onChange={(v) => updateEducation(i, "degree", v)} 
                className="font-bold text-zinc-900 leading-snug"
                style={{ fontSize: toPx(baseFontSize) }}
                placeholder="Diplôme"
              />
              <EditableText 
                value={edu.institution} 
                onChange={(v) => updateEducation(i, "institution", v)} 
                className="text-zinc-600 italic leading-snug mt-0.5"
                style={{ fontSize: toPx(baseFontSize) }}
                placeholder="Institution"
              />

              {/* Item Spacer Drag Handle */}
              <div 
                className="absolute -bottom-1.5 left-0 right-0 h-2 cursor-row-resize bg-transparent hover:bg-sky-400/30 rounded z-30"
                title={`Marge: ${edu.customMarginBottom ?? 4}pt (Glisser pour régler)`}
                onMouseDown={(e) => handleSpacerMouseDown(e, "education", edu.id!, edu.customMarginBottom ?? 4, i)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSummaryHtml = () => {
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Résumé Professionnel" blockId="title_summary" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

        <div data-block-id="content_summary" className="w-full">
          <EditableText 
            value={data.personalInfo.summary} 
            onChange={(v) => updatePersonalInfo("summary", v)} 
            className="text-justify text-zinc-700 font-sans"
            style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
            multiline
            placeholder="Rédigez votre résumé professionnel ici..."
          />
        </div>
      </div>
    );
  };

  const renderExperienceHtml = () => {
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Expérience Professionnelle" blockId="title_experience" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

        <div className="flex flex-col gap-3.5">
          {data.experiences.map((exp, expIdx) => (
            <div 
              key={exp.id ?? expIdx} 
              className="flex flex-col group/exp relative"
              data-block-id={`experience_${expIdx}`}
              style={{ marginBottom: toPx(exp.customMarginBottom ?? 5) }}
            >
              {/* Header: Title - Org | Date */}
              <div className="flex justify-between items-start leading-snug">
                <div className="flex-1 font-bold text-zinc-900 pr-4">
                  <EditableText 
                    value={exp.title} 
                    onChange={(v) => updateExperience(expIdx, "title", v)} 
                    placeholder="Intitulé du poste"
                    style={{ fontSize: toPx(baseFontSize + 0.5) }}
                  />
                  <span className="text-zinc-400 mx-1">—</span>
                  <EditableText 
                    value={exp.org} 
                    onChange={(v) => updateExperience(expIdx, "org", v)} 
                    placeholder="Entreprise"
                    style={{ fontSize: toPx(baseFontSize + 0.5), color: primaryColor !== "#1a1a1a" ? primaryColor : undefined }}
                  />
                </div>
                <EditableText 
                  value={exp.date} 
                  onChange={(v) => updateExperience(expIdx, "date", v)} 
                  placeholder="Date"
                  className="text-zinc-500 font-medium shrink-0"
                  style={{ fontSize: toPx(baseFontSize - 1) }}
                />
              </div>

              {/* Bullets List */}
              <ul className="flex flex-col gap-0.5 mt-1 list-none pl-0">
                {exp.bullets.map((bullet, bulletIdx) => (
                  <li key={bulletIdx} className="group/bullet flex items-start gap-1.5 relative text-justify">
                    <span className="font-bold select-none shrink-0" style={{ color: primaryColor, fontSize: toPx(baseFontSize) }}>•</span>
                    <EditableText 
                      value={bullet} 
                      onChange={(v) => updateExperienceBullet(expIdx, bulletIdx, v)} 
                      className="text-zinc-700 flex-1 leading-relaxed"
                      style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                      multiline
                    />
                    
                    {/* Delete bullet button */}
                    <button
                      type="button"
                      onClick={() => removeExperienceBullet(expIdx, bulletIdx)}
                      className="opacity-0 group-hover/bullet:opacity-100 absolute -right-5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-30 transition-opacity"
                      title="Supprimer la puce"
                    >
                      <Trash2 size={10} />
                    </button>
                  </li>
                ))}
              </ul>

              {/* Add Bullet Button inside exp */}
              <button
                type="button"
                onClick={() => addExperienceBullet(expIdx)}
                className="opacity-0 group-hover/exp:opacity-100 flex items-center gap-1 mt-1 text-[9px] text-zinc-400 hover:text-primary transition-opacity self-start z-30"
              >
                <PlusCircle size={10} /> Ajouter une puce
              </button>

              {/* Item Spacer Drag Handle */}
              <div 
                className="absolute -bottom-2.5 left-0 right-0 h-2.5 cursor-row-resize bg-transparent hover:bg-sky-400/30 rounded z-30"
                title={`Marge: ${exp.customMarginBottom ?? 5}pt (Glisser pour régler)`}
                onMouseDown={(e) => handleSpacerMouseDown(e, "experience", exp.id!, exp.customMarginBottom ?? 5, expIdx)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProjectsHtml = () => {
    return (
      <div className="flex flex-col gap-1.5 text-left w-full">
        <CanvasSectionHeading title="Projets" blockId="title_projects" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

        <div className="flex flex-col gap-3.5">
          {data.projects.map((proj, i) => (
            <div 
              key={proj.id ?? i} 
              className="flex flex-col group/proj relative"
              data-block-id={`project_${i}`}
              style={{ marginBottom: toPx(proj.customMarginBottom ?? 5) }}
            >
              <EditableText 
                value={proj.title} 
                onChange={(v) => updateProject(i, "title", v)} 
                className="font-bold text-zinc-950 leading-snug"
                style={{ fontSize: toPx(baseFontSize + 0.5) }}
                placeholder="Nom du projet"
              />
              <EditableText 
                value={proj.description} 
                onChange={(v) => updateProject(i, "description", v)} 
                className="text-zinc-700 text-justify leading-relaxed mt-0.5"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                multiline
                placeholder="Description du projet..."
              />
              {proj.stack && (
                <div className="text-zinc-500 mt-0.5" style={{ fontSize: toPx(baseFontSize - 0.5) }}>
                  <span className="font-bold text-zinc-800">Stack: </span>
                  <EditableText 
                    value={proj.stack} 
                    onChange={(v) => updateProject(i, "stack", v)} 
                    placeholder="React, Node..."
                    className="italic"
                  />
                </div>
              )}

              {/* Item Spacer Drag Handle */}
              <div 
                className="absolute -bottom-2.5 left-0 right-0 h-2.5 cursor-row-resize bg-transparent hover:bg-sky-400/30 rounded z-30"
                title={`Marge: ${proj.customMarginBottom ?? 5}pt (Glisser pour régler)`}
                onMouseDown={(e) => handleSpacerMouseDown(e, "project", proj.id!, proj.customMarginBottom ?? 5, i)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCertificationsHtml = () => (
    <div className="flex flex-col gap-1.5 text-left w-full">
      <CanvasSectionHeading title="Certifications" blockId="title_certifications" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

      <div data-block-id="content_certifications">
        <EditableText
          value={data.personalInfo.certifications ?? ""}
          onChange={(v) => updatePersonalInfo("certifications", v)}
          className="text-zinc-800 w-full"
          style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
          multiline
          placeholder="Certification 1, Certification 2..."
        />
      </div>
    </div>
  );

  const renderInterestsHtml = () => (
    <div className="flex flex-col gap-1.5 text-left w-full">
      <CanvasSectionHeading title="Intérêts" blockId="title_interests" headingFontSize={headingFontSize} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />

      <div data-block-id="content_interests">
        <EditableText
          value={data.personalInfo.interests ?? ""}
          onChange={(v) => updatePersonalInfo("interests", v)}
          className="text-zinc-800 w-full"
          style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
          multiline
          placeholder="Lecture · Voyages · Sport..."
        />
      </div>
    </div>
  );

  // Maps Section ID -> HTML renderer
  const SECTION_HTML_RENDERERS: Record<string, () => React.ReactNode> = {
    contact: renderContactHtml,
    skills: renderSkillsHtml,
    languages: renderLanguagesHtml,
    education: renderEducationHtml,
    summary: renderSummaryHtml,
    experience: renderExperienceHtml,
    projects: renderProjectsHtml,
    certifications: renderCertificationsHtml,
    interests: renderInterestsHtml,
  };

  // Helper to render a draggable section card
  const renderDraggableSection = (id: string, pageIndex: number, col: "main" | "sidebar") => {
    const renderContent = SECTION_HTML_RENDERERS[id];
    if (!renderContent) return null;

    const content = renderContent();
    if (!content) return null;

    const isTarget = dropTarget && dropTarget.id === id;
    const isDragged = dragged && dragged.id === id;

    return (
      <div
        key={id}
        draggable
        onDragStart={(e) => handleDragStart(e, id, pageIndex, col)}
        onDragOver={(e) => handleDragOver(e, id, pageIndex, col)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, id, pageIndex, col)}
        className={cn(
          "group/section relative w-full border border-transparent rounded hover:border-dashed hover:border-primary/40 p-1.5 transition-all duration-100",
          isDragged && "opacity-40 border-dashed border-zinc-400 bg-zinc-50",
          isTarget && dropTarget.position === "before" && "border-t-2 border-t-primary/70",
          isTarget && dropTarget.position === "after" && "border-b-2 border-b-primary/70"
        )}
        style={{ 
          marginBottom: toPx(sectionMarginBottom) 
        }}
      >
        {/* Hover action toolbar */}
        <div className="opacity-0 group-hover/section:opacity-100 transition-opacity absolute right-1.5 -top-3 flex items-center gap-1.5 bg-white border border-border/80 shadow-md rounded-md p-1 z-40 select-none">
          <div className="cursor-grab text-zinc-400 hover:text-zinc-700 px-0.5" title="Glisser pour réordonner">
            <GripVertical size={11} />
          </div>
          <button
            type="button"
            onClick={() => handleMoveColumn(pageIndex, col, id)}
            className="text-zinc-400 hover:text-zinc-700 hover:bg-muted p-0.5 rounded"
            title="Déplacer vers l'autre colonne"
          >
            <ArrowLeftRight size={11} />
          </button>
          <button
            type="button"
            onClick={() => handleHideSection(pageIndex, col, id)}
            className="text-zinc-400 hover:text-destructive hover:bg-destructive/10 p-0.5 rounded"
            title="Masquer la section"
          >
            <EyeOff size={11} />
          </button>
        </div>

        {content}

        {/* Section Spacer Drag Handle (Horizontal bar) */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize bg-transparent hover:bg-primary/20 transition-all z-20"
          title={`Espacement: ${sectionMarginBottom}pt (Glisser pour régler)`}
          onMouseDown={(e) => handleSpacerMouseDown(e, "section", id, sectionMarginBottom)}
        />
      </div>
    );
  };

  const renderHtmlColumn = (ids: string[], pageIndex: number, col: "main" | "sidebar") => {
    const visibleIds = ids.filter(id => SECTION_HTML_RENDERERS[id]);

    return (
      <div 
        className={cn(
          "flex flex-col min-h-[50px] transition-colors rounded-sm",
          visibleIds.length === 0 && "border border-dashed border-zinc-200 bg-zinc-50/50 justify-center items-center text-zinc-400 text-xs py-4"
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (visibleIds.length === 0) {
            handleDropOnEmptyColumn(e, pageIndex, col);
          }
        }}
      >
        {visibleIds.length === 0 ? (
          <span className="italic text-[10px]">Colonne {col === "main" ? "Principale" : "Latérale"} Vide</span>
        ) : (
          visibleIds.map(id => renderDraggableSection(id, pageIndex, col))
        )}
      </div>
    );
  };

  // --- HTML Pages Loop ---
  return (
    <div className="flex-1 flex flex-col bg-muted/40 rounded-xl border border-border/40 select-none overflow-hidden w-full">
      
      {/* Visual Canvas Info Header (Toolbar) */}
      <div className="p-3 border-b border-border/45 bg-background/95 backdrop-blur-md z-20 shrink-0 w-full flex flex-col gap-2 shadow-sm">
        <div className="w-full flex items-center justify-between text-xs text-muted-foreground px-2.5 py-1.5 select-none bg-background/50 border border-border/60 rounded-lg gap-4 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Sparkles size={13} className="text-primary animate-pulse shrink-0" />
            {layout.useAbsolutePositioning ? (
              <span className="truncate"><b>Mode Canva :</b> Déplacez les éléments au millimètre près. Étirez les bords droits pour redimensionner.</span>
            ) : (
              <span className="truncate"><b>Mode Alignement (Colonnes) :</b> Modifiez les textes et réordonnez par colonnes de manière fluide.</span>
            )}
          </div>
          
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Guide labels in absolute mode */}
            {layout.useAbsolutePositioning && (
              <div className="hidden lg:flex gap-2 text-[10px] text-muted-foreground mr-1">
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-zinc-300" /> Glisser = Déplacer</span>
                <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-sky-300" /> Glisser Bords = Dimensions</span>
              </div>
            )}

            {/* Pages */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/80 shadow-sm select-none">
              {layout.pages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePageIndex(idx)}
                  className={cn(
                    "px-2 py-0.5 text-[9px] font-semibold rounded-md transition-all h-6",
                    activePageIndex === idx
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  P{idx + 1}
                </button>
              ))}
              <button
                type="button"
                onClick={addPage}
                className="p-1 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center rounded"
                title="Ajouter une page"
              >
                <FilePlus size={11} />
              </button>
              {layout.pages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePage(activePageIndex)}
                  className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive h-6 w-6 flex items-center justify-center rounded"
                  title="Supprimer la page active"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>

            {/* Zoom & réalignement */}
            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border/80 mr-1 shadow-sm select-none">
                {layout.useAbsolutePositioning && (
                  <>
                    <button
                      type="button"
                      onClick={handleRealign}
                      className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-md bg-background hover:bg-muted/80 text-foreground transition-all shadow-sm h-6"
                      title="Réaligner automatiquement tous les blocs à partir des colonnes auto"
                    >
                      <Sparkles size={11} className="text-primary" />
                      <span>Réaligner</span>
                    </button>
                    <div className="w-px h-3 bg-border/60 mx-1" />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                  className="p-1 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center transition-all rounded"
                  title="Zoom arrière"
                >
                  <Minus size={11} />
                </button>

                <span className="text-[10px] font-mono font-medium min-w-[32px] text-center select-none text-foreground">
                  {Math.round(zoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(2.0, prev + 0.1))}
                  className="p-1 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 w-6 flex items-center justify-center transition-all rounded"
                  title="Zoom avant"
                >
                  <Plus size={11} />
                </button>

                <button
                  type="button"
                  onClick={() => setZoom(1.0)}
                  className="px-1.5 py-0.5 hover:bg-background/80 text-muted-foreground hover:text-foreground h-6 text-[9px] font-medium flex items-center justify-center transition-all rounded"
                  title="Réinitialiser zoom"
                >
                  Ajuster
                </button>
              </div>

            {/* Toggle positioning mode */}
            <div className="flex bg-muted rounded-lg p-0.5 border border-border/80 shrink-0 select-none shadow-sm">
              <button
                type="button"
                onClick={() => {
                  onChange({
                    ...data,
                    layout: {
                      ...layout,
                      useAbsolutePositioning: false
                    }
                  });
                }}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-semibold rounded-md transition-all h-6 flex items-center",
                  !layout.useAbsolutePositioning ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Colonnes Auto
              </button>
              <button
                type="button"
                onClick={() => {
                  if (layout.useAbsolutePositioning) return;
                  enableAbsoluteMode();
                }}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-semibold rounded-md transition-all h-6 flex items-center",
                  layout.useAbsolutePositioning ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Mode Canva (Libre)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pages Container scrollbar view */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-6 min-h-0 w-full scrollbar-thin">
        {layout.pages.map((page, pageIndex) => {
          const hasSidebar = page.sidebar.some(id => SECTION_HTML_RENDERERS[id]);
          const absolutePositions = layout.absolutePositions ?? defaultPositions;
          const mergedAbsolutePositions = { ...defaultPositions, ...absolutePositions };
          const absolutePageHeightPx =
            estimateAbsolutePageHeightPt(mergedAbsolutePositions, data) * PT_TO_PX;
          const pageZoom = layout.useAbsolutePositioning ? zoom : 1;


        const getAbsoluteBlockRenderer = (blockId: string): React.ReactNode => {
          const headingSizeVal = headingFontSize;
          const { personalInfo } = data;

          const renderTitle = (title: string, sectionId: string) => (
            <CanvasSectionHeading title={title} blockId={`title_${sectionId}`} headingFontSize={headingSizeVal} primaryColor={primaryColor} onFontSizeChange={(s) => updateThemeValue({ headingSize: s })} />
          );

          if (blockId.startsWith("title_")) {
            const secId = blockId.substring(6);
            const labels: Record<string, string> = {
              contact: "Contact",
              skills: "Compétences",
              languages: "Langues",
              education: "Formation",
              summary: "Résumé Professionnel",
              experience: "Expérience Professionnelle",
              projects: "Projets",
              certifications: "Certifications",
              interests: "Intérêts"
            };
            return renderTitle(labels[secId] || secId, secId);
          }

          if (blockId === "content_contact") {
            return (
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500">Email</span>
                  <EditableText 
                    value={personalInfo.email} 
                    onChange={(v) => updatePersonalInfo("email", v)} 
                    className="font-medium text-zinc-800 break-all"
                    style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500">Téléphone</span>
                  <EditableText 
                    value={personalInfo.phone} 
                    onChange={(v) => updatePersonalInfo("phone", v)} 
                    className="font-medium text-zinc-800"
                    style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500">Localisation</span>
                  <EditableText 
                    value={personalInfo.location} 
                    onChange={(v) => updatePersonalInfo("location", v)} 
                    className="font-medium text-zinc-800"
                    style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500">LinkedIn</span>
                  <EditableText 
                    value={personalInfo.linkedin} 
                    onChange={(v) => updatePersonalInfo("linkedin", v)} 
                    className="font-medium text-zinc-800 break-all"
                    style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  />
                </div>
                {personalInfo.portfolio !== undefined && (
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">Portfolio</span>
                    <EditableText 
                      value={personalInfo.portfolio} 
                      onChange={(v) => updatePersonalInfo("portfolio", v)} 
                      className="font-medium text-zinc-800 break-all"
                      style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                    />
                  </div>
                )}
              </div>
            );
          }

          if (blockId.startsWith("skill_")) {
            const match = blockId.match(/^skill_(\d+)$/);
            if (!match) return null;
            const idx = parseInt(match[1]);
            const group = data.skills[idx];
            if (!group) return null;
            return (
              <div className="flex flex-col w-full text-left">
                <EditableText 
                  value={group.category} 
                  onChange={(v) => updateSkillGroup(idx, "category", v)} 
                  className="font-bold text-zinc-800"
                  style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  placeholder="Catégorie"
                />
                <EditableText 
                  value={group.items} 
                  onChange={(v) => updateSkillGroup(idx, "items", v)} 
                  className="text-zinc-600 mt-0.5"
                  style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  placeholder="Compétence 1, Compétence 2..."
                />
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
                    onChange={(v) => updateLanguage(i, v)} 
                    className="text-zinc-800"
                    style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                    placeholder="ex: Français (Natif)"
                  />
                ))}
              </div>
            );
          }

          if (blockId.startsWith("education_")) {
            const match = blockId.match(/^education_(\d+)$/);
            if (!match) return null;
            const idx = parseInt(match[1]);
            const edu = data.education[idx];
            if (!edu) return null;
            return (
              <div className="flex flex-col w-full text-left group/edu relative">
                <EditableText 
                  value={edu.degree} 
                  onChange={(v) => updateEducation(idx, "degree", v)} 
                  className="font-bold text-zinc-900 leading-snug"
                  style={{ fontSize: toPx(baseFontSize) }}
                  placeholder="Diplôme"
                />
                <EditableText 
                  value={edu.institution} 
                  onChange={(v) => updateEducation(idx, "institution", v)} 
                  className="text-zinc-600 italic leading-snug mt-0.5"
                  style={{ fontSize: toPx(baseFontSize) }}
                  placeholder="Institution"
                />
              </div>
            );
          }

          if (blockId === "content_summary") {
            return (
              <EditableText 
                value={personalInfo.summary} 
                onChange={(v) => updatePersonalInfo("summary", v)} 
                className="text-justify text-zinc-700 font-sans w-full"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                multiline
                placeholder="Rédigez votre résumé professionnel ici..."
              />
            );
          }

          if (blockId.startsWith("experience_")) {
            const match = blockId.match(/^experience_(\d+)$/);
            if (!match) return null;
            const idx = parseInt(match[1]);
            const exp = data.experiences[idx];
            if (!exp) return null;
            return (
              <div className="flex flex-col w-full text-left group/exp relative">
                <div className="flex justify-between items-start leading-snug">
                  <div className="flex-1 font-bold text-zinc-900 pr-4">
                    <EditableText 
                      value={exp.title} 
                      onChange={(v) => updateExperience(idx, "title", v)} 
                      placeholder="Intitulé du poste"
                      style={{ fontSize: toPx(baseFontSize + 0.5) }}
                    />
                    <span className="text-zinc-400 mx-1">—</span>
                    <EditableText 
                      value={exp.org} 
                      onChange={(v) => updateExperience(idx, "org", v)} 
                      placeholder="Entreprise"
                      style={{ fontSize: toPx(baseFontSize + 0.5), color: primaryColor !== "#1a1a1a" ? primaryColor : undefined }}
                    />
                  </div>
                  <EditableText 
                    value={exp.date} 
                    onChange={(v) => updateExperience(idx, "date", v)} 
                    placeholder="Date"
                    className="text-zinc-500 font-medium shrink-0"
                    style={{ fontSize: toPx(baseFontSize - 1) }}
                  />
                </div>
                <ul className="flex flex-col gap-0.5 mt-1 list-none pl-0">
                  {exp.bullets.map((bullet, bulletIdx) => (
                    <li key={bulletIdx} className="group/bullet flex items-start gap-1.5 relative text-justify">
                      <span className="font-bold select-none shrink-0" style={{ color: primaryColor, fontSize: toPx(baseFontSize) }}>•</span>
                      <EditableText 
                        value={bullet} 
                        onChange={(v) => updateExperienceBullet(idx, bulletIdx, v)} 
                        className="text-zinc-700 flex-1 leading-relaxed"
                        style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                        multiline
                      />
                      <button
                        type="button"
                        onClick={() => removeExperienceBullet(idx, bulletIdx)}
                        className="opacity-0 group-hover/bullet:opacity-100 absolute -right-5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 z-30 transition-opacity"
                        title="Supprimer la puce"
                      >
                        <Trash2 size={10} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => addExperienceBullet(idx)}
                  className="opacity-0 group-hover/exp:opacity-100 flex items-center gap-1 mt-1 text-[9px] text-zinc-400 hover:text-primary transition-opacity self-start z-30"
                >
                  <PlusCircle size={10} /> Ajouter une puce
                </button>
              </div>
            );
          }

          if (blockId.startsWith("project_")) {
            const match = blockId.match(/^project_(\d+)$/);
            if (!match) return null;
            const idx = parseInt(match[1]);
            const proj = data.projects[idx];
            if (!proj) return null;
            return (
              <div className="flex flex-col w-full text-left group/proj relative">
                <EditableText 
                  value={proj.title} 
                  onChange={(v) => updateProject(idx, "title", v)} 
                  className="font-bold text-zinc-950 leading-snug"
                  style={{ fontSize: toPx(baseFontSize + 0.5) }}
                  placeholder="Nom du projet"
                />
                <EditableText 
                  value={proj.description} 
                  onChange={(v) => updateProject(idx, "description", v)} 
                  className="text-zinc-700 text-justify leading-relaxed mt-0.5"
                  style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                  multiline
                  placeholder="Description du projet..."
                />
                {proj.stack && (
                  <div className="text-zinc-500 mt-0.5" style={{ fontSize: toPx(baseFontSize - 0.5) }}>
                    <span className="font-bold text-zinc-800">Stack: </span>
                    <EditableText 
                      value={proj.stack} 
                      onChange={(v) => updateProject(idx, "stack", v)} 
                      placeholder="React, Node..."
                      className="italic"
                    />
                  </div>
                )}
              </div>
            );
          }

          if (blockId === "content_certifications") {
            return (
              <EditableText
                value={personalInfo.certifications ?? ""}
                onChange={(v) => updatePersonalInfo("certifications", v)}
                className="text-zinc-800 w-full text-left"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                multiline
                placeholder="Certification 1, Certification 2..."
              />
            );
          }

          if (blockId === "content_interests") {
            return (
              <EditableText
                value={personalInfo.interests ?? ""}
                onChange={(v) => updatePersonalInfo("interests", v)}
                className="text-zinc-800 w-full text-left"
                style={{ fontSize: toPx(baseFontSize), lineHeight: lh }}
                multiline
                placeholder="Lecture · Voyages · Sport..."
              />
            );
          }

          return null;
        };

        const renderAbsoluteBlock = (id: string, content: React.ReactNode) => {
          let pos = absolutePositions[id] ?? defaultPositions[id] ?? { x: 50, y: 100, w: 200 };
          if (id === "photo") {
            const pf = getDefaultPhotoPosition(template, sidebarWidth);
            pos = { ...pos, w: pf.w };
          }

          return (
            <div
              key={id}
              data-block-id={id}
              style={{
                position: "absolute",
                left: toPx(pos.x),
                top: toPx(pos.y),
                width: pos.w ? toPx(pos.w) : undefined,
                zIndex: 10,
              }}
              className="group/abs border border-transparent hover:border-dashed hover:border-primary/40 rounded p-1 transition-all duration-100 cursor-move bg-white/10 hover:bg-white/40 hover:shadow-sm"
              onMouseDown={(e) => handleAbsoluteDragStart(e, id, pos)}
            >
              {/* Width Resize Handle */}
              <div
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-transparent hover:bg-primary/20 hover:opacity-100 opacity-0 z-30 transition-all rounded"
                title="Glisser pour ajuster la largeur"
                onMouseDown={(e) => handleWidthResizeMouseDown(e, id, pos)}
              />

              {/* Hover action toolbar */}
              <div 
                className="opacity-0 group-hover/abs:opacity-100 transition-opacity absolute right-1.5 -top-3.5 flex items-center gap-1 bg-white border border-border/80 shadow-md rounded px-1.5 py-0.5 z-40 select-none cursor-default text-[9px] font-mono text-muted-foreground" 
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span>X:{pos.x} Y:{pos.y} {pos.w ? `W:${pos.w}` : ""}</span>
                {ALL_SECTION_IDS.includes(getParentSectionId(id) as SectionId) && (
                  <button
                    type="button"
                    onClick={() => {
                      const parentId = getParentSectionId(id);
                      handleHideSection(pageIndex, page.main.includes(parentId) ? "main" : "sidebar", parentId);
                    }}
                    className="text-zinc-400 hover:text-destructive hover:bg-destructive/10 p-0.5 rounded ml-1"
                    title="Masquer la section"
                  >
                    <EyeOff size={10} />
                  </button>
                )}
              </div>

              {content}
            </div>
          );
        };

        const renderAbsoluteHeaderAndPhoto = () => {
          if (pageIndex !== 0) return null;

          const { personalInfo } = data;
          const photoFallback = getDefaultPhotoPosition(template, sidebarWidth);
          const photoPos = absolutePositions.photo ?? defaultPositions.photo ?? photoFallback;
          const photoSize = photoPos.w ?? photoFallback.w;

          const photoContent = (
            <div className="flex justify-center items-center">
              <div
                className={cn(
                  "rounded-full overflow-hidden border bg-zinc-200 flex items-center justify-center shadow-sm",
                  isChaima && "border-2"
                )}
                style={{
                  width: toPx(photoSize),
                  height: toPx(photoSize),
                  borderColor: isChaima ? primaryColor : "#d4d4d8",
                }}
              >
                {personalInfo.photo ? (
                  <img src={personalInfo.photo} alt="Avatar" className="size-full object-cover" />
                ) : isChaima ? (
                  <svg viewBox="0 0 100 100" className="size-full">
                    <circle cx="50" cy="40" r="18" fill="#475569" />
                    <path
                      d="M 22,82 C 22,65 34,58 50,58 C 66,58 78,65 78,82 C 78,85 75,85 50,85 C 25,85 22,85 22,82 Z"
                      fill="#475569"
                    />
                  </svg>
                ) : null}
              </div>
            </div>
          );

          return (
            <>
              {(personalInfo.photo || isChaima) &&
                renderAbsoluteBlock("photo", photoContent)}

              {/* Name */}
              {renderAbsoluteBlock("name", (
                <div className="relative group/h1">
                  <EditableText 
                    value={personalInfo.name} 
                    onChange={(v) => updatePersonalInfo("name", v)} 
                    className={cn("font-bold tracking-tight select-text text-zinc-900 leading-snug", isChaima && "uppercase")}
                    style={{ fontSize: toPx(baseFontSize * 2.4) }}
                    placeholder="Nom complet"
                  />
                </div>
              ))}

              {/* Role */}
              {renderAbsoluteBlock("role", (
                <EditableText 
                  value={personalInfo.role} 
                  onChange={(v) => updatePersonalInfo("role", v)} 
                  className={cn("font-bold tracking-wider", isChaima && "uppercase")}
                  style={{ 
                    fontSize: toPx(baseFontSize + 1.5), 
                    color: primaryColor,
                    lineHeight: 1.2
                  }}
                  placeholder="Titre professionnel"
                />
              ))}

              {/* Tech Line */}
              {renderAbsoluteBlock("techLine", (
                <EditableText 
                  value={personalInfo.techLine} 
                  onChange={(v) => updatePersonalInfo("techLine", v)} 
                  className="text-zinc-500 leading-snug"
                  style={{ fontSize: toPx(baseFontSize - 1) }}
                  placeholder="Technologies clés (ex: React · Node · Next.js)"
                />
              ))}
            </>
          );
        };

        // --- CANVA ABSOLUTE LAYOUT MODE ---
        if (layout.useAbsolutePositioning) {
          const sidebarBgStyle = {
            position: "absolute" as const,
            left: 0,
            top: 0,
            width: toPx(sidebarWidth),
            height: "100%",
            backgroundColor: sidebarBg,
            borderRight: isChaima ? "1px solid #e4e4e7" : "none",
            zIndex: 1,
          };

          return (
            <CVPageScaleWrapper
              key={pageIndex}
              zoom={pageZoom}
              pageIndex={pageIndex}
              onScaleChange={handleScaleChange}
              fitToContainer
              minContentHeightPx={absolutePageHeightPx}
            >
              <div
                id={`cv-page-${pageIndex}`}
                className={cn(
                  "w-full text-zinc-800 text-left box-border relative",
                  activePageIndex === pageIndex && layout.pages.length > 1 && "ring-2 ring-primary/30 ring-offset-2 rounded-sm"
                )}
                style={{
                  color: textColor,
                  fontFamily: "'Carlito', sans-serif",
                  minHeight: `${absolutePageHeightPx}px`,
                }}
              >
                {hasSidebar && sidebarBg !== "transparent" && (
                  <div style={{ ...sidebarBgStyle, height: `${absolutePageHeightPx}px` }} />
                )}

                {/* Column resize helper dividing line */}
                {hasSidebar && (
                  <div
                    className="absolute hover:bg-primary/40 hover:opacity-100 bg-transparent opacity-0 cursor-col-resize h-full transition-all duration-100 z-30"
                    style={{ left: toPx(sidebarWidth), width: "6px" }}
                    title="Ajuster largeur sidebar"
                    onMouseDown={handleSidebarResizeMouseDown}
                  />
                )}

                {/* Draggable Header items */}
                {renderAbsoluteHeaderAndPhoto()}

                {/* Decomposed Draggable Sidebar Sections */}
                {page.sidebar.flatMap(sectionId => getSectionBlockIds(sectionId, data)).map(blockId => {
                  const blockContent = getAbsoluteBlockRenderer(blockId);
                  if (!blockContent) return null;
                  return renderAbsoluteBlock(blockId, blockContent);
                })}

                {/* Decomposed Draggable Main Sections */}
                {page.main.flatMap(sectionId => getSectionBlockIds(sectionId, data)).map(blockId => {
                  const blockContent = getAbsoluteBlockRenderer(blockId);
                  if (!blockContent) return null;
                  return renderAbsoluteBlock(blockId, blockContent);
                })}
              </div>
            </CVPageScaleWrapper>
          );
        }

        // --- TRADITIONAL COLUMN FLOW LAYOUT MODE ---
        // CLASSIC TEMPLATE HTML
        if (!isChaima) {
          return (
            <CVPageScaleWrapper
              key={pageIndex}
              zoom={pageZoom}
              pageIndex={pageIndex}
              onScaleChange={handleScaleChange}
              fitToContainer
              allowContentOverflow
            >
              <div
                id={`cv-page-${pageIndex}`}
                className={cn(
                  "flex flex-col w-full text-zinc-800 text-left box-border pt-3 pb-3 px-6",
                  activePageIndex === pageIndex && layout.pages.length > 1 && "ring-2 ring-primary/30 ring-offset-2 rounded-sm"
                )}
                style={{ color: textColor, fontFamily: "'Carlito', sans-serif" }}
              >
                {/* Header (page 0 only) */}
                {pageIndex === 0 && (
                  <div 
                    className="border-b pb-1 mb-1.5 flex flex-col items-start select-none group/header relative"
                    style={{ borderBottomColor: primaryColor }}
                  >
                    <div className="w-full relative group/h1" data-block-id="name">
                      <EditableText 
                        value={data.personalInfo.name} 
                        onChange={(v) => updatePersonalInfo("name", v)} 
                        className="font-bold tracking-tight select-text text-zinc-900 leading-snug"
                        style={{ fontSize: toPx(baseFontSize * 2.4) }}
                        placeholder="Nom complet"
                      />
                      {/* Name font resizer */}
                      <span className="opacity-0 group-hover/h1:opacity-100 absolute left-full ml-3 top-1/2 -translate-y-1/2 flex items-center bg-background border rounded px-1 py-0.5 text-[10px] font-normal text-muted-foreground z-30 select-none">
                        <button type="button" onClick={() => updateThemeValue({ fontSize: Math.max(8, baseFontSize - 0.5) })} className="p-0.5 hover:bg-muted rounded"><Minus size={10}/></button>
                        <span className="mx-1">{baseFontSize}pt</span>
                        <button type="button" onClick={() => updateThemeValue({ fontSize: Math.min(14, baseFontSize + 0.5) })} className="p-0.5 hover:bg-muted rounded"><Plus size={10}/></button>
                      </span>
                    </div>

                    <div className="w-full" data-block-id="role">
                      <EditableText 
                        value={data.personalInfo.role} 
                        onChange={(v) => updatePersonalInfo("role", v)} 
                        className="font-bold mt-0.5"
                        style={{ 
                          fontSize: toPx(baseFontSize + 2), 
                          color: primaryColor !== "#1a1a1a" ? primaryColor : textColor,
                          lineHeight: 1.2
                        }}
                        placeholder="Titre professionnel"
                      />
                    </div>

                    <div className="w-full" data-block-id="techLine">
                      <EditableText 
                        value={data.personalInfo.techLine} 
                        onChange={(v) => updatePersonalInfo("techLine", v)} 
                        className="text-zinc-500 mt-1 leading-snug"
                        style={{ fontSize: toPx(baseFontSize - 1) }}
                        placeholder="Technologies clés (ex: React · Node · Next.js)"
                      />
                    </div>
                  </div>
                )}

                {/* Two-column or full layout body */}
                <div className="flex gap-6 mt-1 select-none relative">
                  {hasSidebar && (
                    <>
                      {/* Sidebar */}
                      <div
                        className="flex flex-col shrink-0"
                        style={{ width: toPx(sidebarWidth), backgroundColor: sidebarBg }}
                      >
                        {pageIndex === 0 && data.personalInfo.photo && (
                          <div className="flex justify-center items-center mb-3">
                            <div
                              className="size-16 rounded-full overflow-hidden border border-zinc-300 shadow-sm"
                              data-block-id="photo"
                            >
                              <img src={data.personalInfo.photo} alt="Avatar" className="size-full object-cover" />
                            </div>
                          </div>
                        )}
                        {renderHtmlColumn(page.sidebar, pageIndex, "sidebar")}
                      </div>

                      {/* Column resizer border line */}
                      <div 
                        className="w-1.5 hover:w-2 hover:bg-primary/40 hover:opacity-100 bg-transparent opacity-0 cursor-col-resize h-full shrink-0 select-none transition-all duration-100 rounded z-30"
                        title="Glisser pour ajuster la largeur de la colonne"
                        onMouseDown={handleSidebarResizeMouseDown}
                      />
                    </>
                  )}

                  {/* Main column */}
                  <div className="flex-1 min-w-0 select-none">
                    {renderHtmlColumn(page.main, pageIndex, "main")}
                  </div>
                </div>
              </div>
            </CVPageScaleWrapper>
          );
        }

        // MODERN TEMPLATE HTML (Chaima)
        return (
          <CVPageScaleWrapper
            key={pageIndex}
            zoom={pageZoom}
            pageIndex={pageIndex}
            onScaleChange={handleScaleChange}
            fitToContainer
            allowContentOverflow
          >
            <div
              id={`cv-page-${pageIndex}`}
              className={cn(
                "flex w-full text-zinc-800 text-left box-border",
                activePageIndex === pageIndex && layout.pages.length > 1 && "ring-2 ring-primary/30 ring-offset-2 rounded-sm"
              )}
              style={{ color: textColor, fontFamily: "'Carlito', sans-serif" }}
            >
              {/* Sidebar Left Column */}
              {hasSidebar && (
                <>
                  <div 
                    className="flex flex-col shrink-0 p-4 relative"
                    style={{
                      width: toPx(sidebarWidth),
                      backgroundColor: sidebarBg,
                      borderRight: "1px solid #e4e4e7",
                    }}
                  >
                    {/* Circle Avatar (page 0 only) */}
                    {pageIndex === 0 && (
                      <div className="flex flex-col items-center mb-4">
                        <div 
                          className="size-[65px] rounded-full overflow-hidden border-2 bg-zinc-200 flex items-center justify-center shadow-sm select-none"
                          style={{ borderColor: primaryColor }}
                          data-block-id="photo"
                        >
                          {data.personalInfo.photo ? (
                            <img src={data.personalInfo.photo} alt="Avatar" className="size-full object-cover" />
                          ) : (
                            <div className="size-full bg-zinc-200 flex items-center justify-center text-zinc-400">
                              <svg viewBox="0 0 100 100" className="size-full">
                                <circle cx="50" cy="40" r="18" fill="#475569" />
                                <path
                                  d="M 22,82 C 22,65 34,58 50,58 C 66,58 78,65 78,82 C 78,85 75,85 50,85 C 25,85 22,85 22,82 Z"
                                  fill="#475569"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sidebar content */}
                    {renderHtmlColumn(page.sidebar, pageIndex, "sidebar")}
                  </div>

                  {/* Column Resizer Divider */}
                  <div 
                    className="w-1.5 hover:w-2 hover:bg-primary/40 hover:opacity-100 bg-transparent opacity-0 cursor-col-resize h-full shrink-0 select-none transition-all duration-100 rounded z-30"
                    title="Glisser pour ajuster la largeur de la colonne"
                    onMouseDown={handleSidebarResizeMouseDown}
                  />
                </>
              )}

              {/* Main Column */}
              <div className="flex-1 flex flex-col p-5 bg-white min-w-0 select-none">
                
                {/* Header (Page 0 only) */}
                {pageIndex === 0 && (
                  <div 
                    className="border-b-2 pb-2 mb-3 flex flex-col items-start group/header relative"
                    style={{ borderBottomColor: primaryColor }}
                  >
                    <div className="w-full relative group/h1" data-block-id="name">
                      <EditableText 
                        value={data.personalInfo.name} 
                        onChange={(v) => updatePersonalInfo("name", v)} 
                        className="font-bold tracking-tight select-text text-zinc-900 leading-snug uppercase"
                        style={{ fontSize: toPx(baseFontSize * 2.2) }}
                        placeholder="Nom complet"
                      />
                      {/* Name font resizer */}
                      <span className="opacity-0 group-hover/h1:opacity-100 absolute left-full ml-3 top-1/2 -translate-y-1/2 flex items-center bg-background border rounded px-1 py-0.5 text-[10px] font-normal text-muted-foreground z-30 select-none">
                        <button type="button" onClick={() => updateThemeValue({ fontSize: Math.max(8, baseFontSize - 0.5) })} className="p-0.5 hover:bg-muted rounded"><Minus size={10}/></button>
                        <span className="mx-1">{baseFontSize}pt</span>
                        <button type="button" onClick={() => updateThemeValue({ fontSize: Math.min(14, baseFontSize + 0.5) })} className="p-0.5 hover:bg-muted rounded"><Plus size={10}/></button>
                      </span>
                    </div>

                    <div className="w-full" data-block-id="role">
                      <EditableText 
                        value={data.personalInfo.role} 
                        onChange={(v) => updatePersonalInfo("role", v)} 
                        className="font-bold mt-1 tracking-wider uppercase"
                        style={{ 
                          fontSize: toPx(baseFontSize + 1.5), 
                          color: primaryColor,
                          lineHeight: 1.2
                        }}
                        placeholder="DEVELOPPEUSE WEB ET MOBILE FULL STACK"
                      />
                    </div>

                    <div className="w-full" data-block-id="techLine">
                      <EditableText 
                        value={data.personalInfo.techLine} 
                        onChange={(v) => updatePersonalInfo("techLine", v)} 
                        className="text-zinc-500 mt-1 leading-snug"
                        style={{ fontSize: toPx(baseFontSize - 1) }}
                        placeholder="Technologies clés (ex: React · Node · Next.js)"
                      />
                    </div>
                  </div>
                )}

                {/* Main Content Areas */}
                <div>
                  {renderHtmlColumn(page.main, pageIndex, "main")}
                </div>
              </div>
            </div>
          </CVPageScaleWrapper>
        );
      })}
      </div>
    </div>
  );
}
