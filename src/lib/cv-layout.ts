import type { CVData, CVLayout, LayoutPage, SectionId } from "@/types/cv";

/**
 * Métadonnées des sections "built-in" + layout par défaut.
 * Partagé entre le template (rendu), le builder (gestionnaire de sections) et
 * la page (initialisation). Modèle inspiré de Reactive Resume (layout.pages).
 */

/** Libellés FR affichés dans le builder pour chaque section. */
export const SECTION_LABELS: Record<SectionId, string> = {
  summary: "Résumé",
  experience: "Expériences",
  projects: "Projets",
  contact: "Contact",
  skills: "Compétences",
  languages: "Langues",
  education: "Formations",
  certifications: "Certifications",
  interests: "Intérêts",
};

/** Toutes les sections connues (sert à lister les sections masquées). */
export const ALL_SECTION_IDS: SectionId[] = [
  "summary",
  "experience",
  "projects",
  "contact",
  "skills",
  "languages",
  "education",
  "certifications",
  "interests",
];

/** Largeur par défaut de la colonne latérale (points). */
export const DEFAULT_SIDEBAR_WIDTH = 165;

/**
 * Layout par défaut = reproduit EXACTEMENT la mise en page actuelle de Kompyle :
 * sidebar (contact / skills / langues / formations) + main (résumé / exp / projets),
 * sur une seule page.
 */
export function defaultLayout(): CVLayout {
  return {
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    pages: [
      {
        sidebar: ["contact", "skills", "languages", "education"],
        main: ["summary", "experience", "projects"],
      },
    ],
  };
}

/** Page de layout vide (pour l'ajout de page en Phase C). */
export function emptyLayoutPage(): LayoutPage {
  return { main: [], sidebar: [] };
}

// ─── Sections personnalisées ──────────────────────────────────────────────

/** Libellé d'une section, built-in ou personnalisée. */
export function getSectionLabel(sectionId: string, data?: CVData): string {
  if (sectionId.startsWith("custom_")) {
    const cs = data?.customSections?.find((c) => `custom_${c.id}` === sectionId);
    return cs?.title || "Section personnalisée";
  }
  return SECTION_LABELS[sectionId as SectionId] ?? sectionId;
}

/** Crée une section libre et l'ajoute à la colonne principale de la 1re page. */
export function addCustomSection(data: CVData): CVData {
  const id = crypto.randomUUID();
  const layout = data.layout ?? defaultLayout();
  const pages = layout.pages.length > 0 ? layout.pages : [emptyLayoutPage()];
  const first = pages[0];
  return {
    ...data,
    customSections: [
      ...(data.customSections ?? []),
      { id, title: "Nouvelle section", content: "Votre contenu ici..." },
    ],
    layout: {
      ...layout,
      pages: [{ ...first, main: [...first.main, `custom_${id}`] }, ...pages.slice(1)],
    },
  };
}

/** Supprime une section libre (données + références dans le layout). */
export function removeCustomSection(data: CVData, sectionId: string): CVData {
  const layout = data.layout ?? defaultLayout();
  return {
    ...data,
    customSections: (data.customSections ?? []).filter((c) => `custom_${c.id}` !== sectionId),
    layout: {
      ...layout,
      pages: layout.pages.map((p) => ({
        main: p.main.filter((s) => s !== sectionId),
        sidebar: p.sidebar.filter((s) => s !== sectionId),
      })),
    },
  };
}

const A4_PAGE_HEIGHT_PT = 842;

/** Hauteur minimale de page (pt) pour afficher tous les blocs en mode absolu. */
export function estimateAbsolutePageHeightPt(
  positions: Record<string, { x: number; y: number; w?: number; h?: number }>,
  data: { personalInfo?: { summary?: string }; experiences?: { bullets?: string[] }[]; projects?: { description?: string; stack?: string }[] }
): number {
  let maxBottom = A4_PAGE_HEIGHT_PT;

  for (const [id, pos] of Object.entries(positions)) {
    let h = 28;
    if (pos.h) h = pos.h; // hauteur explicite (redimensionnement manuel)
    else if (id === "photo") h = pos.w ?? 60;
    else if (id.startsWith("title_")) h = 18;
    else if (id === "content_contact") h = 95;
    else if (id === "content_languages") h = Math.max(28, (data as { spokenLanguages?: string[] }).spokenLanguages?.length ?? 1) * 14;
    else if (id === "content_summary") h = Math.ceil(((data.personalInfo?.summary?.length ?? 100) / 58)) * 13 + 12;
    else if (id.startsWith("skill_")) h = 32;
    else if (id.startsWith("education_")) h = 34;
    else if (id.startsWith("experience_")) {
      const idx = Number(id.split("_")[1]);
      const bullets = data.experiences?.[idx]?.bullets?.length ?? 2;
      h = 24 + bullets * 14;
    } else if (id.startsWith("project_")) {
      const idx = Number(id.split("_")[1]);
      const desc = data.projects?.[idx]?.description?.length ?? 80;
      h = 18 + Math.ceil(desc / 52) * 13 + (data.projects?.[idx]?.stack ? 12 : 0);
    } else if (id === "name") h = 22;
    else if (id === "role") h = 16;
    else if (id === "techLine") h = 14;

    maxBottom = Math.max(maxBottom, pos.y + h);
  }

  return maxBottom + 20;
}

/** Position photo alignée sur le mode colonnes (sidebar, pas coin haut-droit). */
export function getDefaultPhotoPosition(
  template: string,
  sidebarWidth = DEFAULT_SIDEBAR_WIDTH
): { x: number; y: number; w: number } {
  if (template === "chaima") {
    return { x: 40, y: 24, w: 65 };
  }
  const photoSize = 60;
  const pagePadding = 24;
  return {
    x: pagePadding + Math.round((sidebarWidth - photoSize) / 2),
    y: 95,
    w: photoSize,
  };
}

/** Positions absolues calculées dynamiquement pour le Mode Canva */
export function computeDefaultPositions(template: string, data: CVData): Record<string, { x: number; y: number; w: number }> {
  const isChaima = template === "chaima";
  const layout: Partial<CVLayout> = data?.layout ?? {};
  const sidebarWidth = layout.sidebarWidth ?? (isChaima ? 175 : 165);
  const pages: LayoutPage[] = layout.pages ?? [{ sidebar: ["contact", "skills", "languages", "education"], main: ["summary", "experience", "projects"] }];

  const positions: Record<string, { x: number; y: number; w: number }> = {};

  // Default header heights — alignés sur le rendu colonnes / PDF
  if (isChaima) {
    positions["photo"] = getDefaultPhotoPosition("chaima", sidebarWidth);
    positions["name"] = { x: 200, y: 20, w: 370 };
    positions["role"] = { x: 200, y: 48, w: 370 };
    positions["techLine"] = { x: 200, y: 66, w: 370 };
  } else {
    positions["name"] = { x: 24, y: 12, w: 450 };
    positions["role"] = { x: 24, y: 42, w: 450 };
    positions["techLine"] = { x: 24, y: 60, w: 450 };
    positions["photo"] = getDefaultPhotoPosition("default", sidebarWidth);
  }

  // Iterate through pages
  pages.forEach((page, pageIndex) => {
    // Stack sidebar:
    let sidebarY = pageIndex === 0 ? (isChaima ? 100 : 95) : 20;
    const sidebarX = isChaima ? 12 : 24;
    const sidebarW = isChaima ? sidebarWidth - 24 : sidebarWidth;

    page.sidebar.forEach((sectionId: string) => {
      // 1. Title
      positions[`title_${sectionId}`] = { x: sidebarX, y: sidebarY, w: sidebarW };
      sidebarY += 22; // title height + spacing

      // 2. Content
      if (sectionId === "contact") {
        positions["content_contact"] = { x: sidebarX, y: sidebarY, w: sidebarW };
        let count = 4;
        if (data?.personalInfo?.portfolio) count++;
        if (data?.personalInfo?.birthDate) count++;
        sidebarY += count * 15 + 10;
      } else if (sectionId === "skills") {
        const skillGroups = data?.skills ?? [];
        skillGroups.forEach((group, idx) => {
          positions[`skill_${idx}`] = { x: sidebarX, y: sidebarY, w: sidebarW };
          const itemsLen = group.items?.length ?? 0;
          sidebarY += 14 + Math.ceil(itemsLen / 35) * 12 + 10;
        });
      } else if (sectionId === "languages") {
        positions["content_languages"] = { x: sidebarX, y: sidebarY, w: sidebarW };
        const langsCount = data?.spokenLanguages?.length ?? 1;
        sidebarY += langsCount * 14 + 10;
      } else if (sectionId === "education") {
        const eduList = data?.education ?? [];
        eduList.forEach((edu, idx) => {
          positions[`education_${idx}`] = { x: sidebarX, y: sidebarY, w: sidebarW };
          sidebarY += 28 + (edu.customMarginBottom ?? 4) + 6;
        });
      } else if (sectionId === "certifications") {
        positions["content_certifications"] = { x: sidebarX, y: sidebarY, w: sidebarW };
        const certsCount = data?.personalInfo?.certifications?.split(",").length ?? 1;
        sidebarY += certsCount * 14 + 10;
      } else if (sectionId === "interests") {
        positions["content_interests"] = { x: sidebarX, y: sidebarY, w: sidebarW };
        const interestsCount = data?.personalInfo?.interests?.split(/[·,]/).length ?? 1;
        sidebarY += interestsCount * 14 + 10;
      } else if (sectionId === "summary") {
        positions["content_summary"] = { x: sidebarX, y: sidebarY, w: sidebarW };
        const summaryLen = data?.personalInfo?.summary?.length ?? 100;
        sidebarY += Math.ceil(summaryLen / 45) * 12 + 15;
      } else if (sectionId.startsWith("custom_")) {
        positions[`content_${sectionId}`] = { x: sidebarX, y: sidebarY, w: sidebarW };
        const cs = data?.customSections?.find((c) => `custom_${c.id}` === sectionId);
        sidebarY += Math.ceil((cs?.content.length ?? 60) / 45) * 12 + 15;
      }
    });

    // Stack main:
    let mainY = pageIndex === 0 ? (isChaima ? 100 : 95) : 20;
    const mainX = isChaima ? sidebarWidth + 20 : sidebarWidth + 30;
    const mainW = isChaima ? 595 - sidebarWidth - 35 : 595 - sidebarWidth - 54;

    page.main.forEach((sectionId: string) => {
      // 1. Title
      positions[`title_${sectionId}`] = { x: mainX, y: mainY, w: mainW };
      mainY += 22;

      // 2. Content
      if (sectionId === "summary") {
        positions["content_summary"] = { x: mainX, y: mainY, w: mainW };
        const summaryLen = data?.personalInfo?.summary?.length ?? 100;
        mainY += Math.ceil(summaryLen / 60) * 13 + 15;
      } else if (sectionId === "experience") {
        const expList = data?.experiences ?? [];
        expList.forEach((exp, idx) => {
          positions[`experience_${idx}`] = { x: mainX, y: mainY, w: mainW };
          const bulletsCount = exp.bullets?.length ?? 2;
          const bulletChars = (exp.bullets ?? []).reduce((n, b) => n + (b?.length ?? 0), 0);
          const bulletLines = Math.max(bulletsCount, Math.ceil(bulletChars / 90));
          mainY += 22 + bulletLines * 15 + (exp.customMarginBottom ?? 5) + 12;
        });
      } else if (sectionId === "projects") {
        const projList = data?.projects ?? [];
        projList.forEach((proj, idx) => {
          positions[`project_${idx}`] = { x: mainX, y: mainY, w: mainW };
          const descLen = proj.description?.length ?? 100;
          let height = 18 + Math.ceil(descLen / 50) * 14;
          if (proj.stack) height += 14;
          mainY += height + (proj.customMarginBottom ?? 5) + 12;
        });
      } else if (sectionId === "contact") {
        positions["content_contact"] = { x: mainX, y: mainY, w: mainW };
        let count = 4;
        if (data?.personalInfo?.portfolio) count++;
        if (data?.personalInfo?.birthDate) count++;
        mainY += count * 15 + 10;
      } else if (sectionId === "skills") {
        const skillGroups = data?.skills ?? [];
        skillGroups.forEach((group, idx) => {
          positions[`skill_${idx}`] = { x: mainX, y: mainY, w: mainW };
          const itemsLen = group.items?.length ?? 0;
          mainY += 14 + Math.ceil(itemsLen / 50) * 12 + 10;
        });
      } else if (sectionId === "languages") {
        positions["content_languages"] = { x: mainX, y: mainY, w: mainW };
        const langsCount = data?.spokenLanguages?.length ?? 1;
        mainY += langsCount * 14 + 10;
      } else if (sectionId === "education") {
        const eduList = data?.education ?? [];
        eduList.forEach((edu, idx) => {
          positions[`education_${idx}`] = { x: mainX, y: mainY, w: mainW };
          mainY += 28 + (edu.customMarginBottom ?? 4) + 6;
        });
      } else if (sectionId === "certifications") {
        positions["content_certifications"] = { x: mainX, y: mainY, w: mainW };
        const certsCount = data?.personalInfo?.certifications?.split(",").length ?? 1;
        mainY += certsCount * 14 + 10;
      } else if (sectionId === "interests") {
        positions["content_interests"] = { x: mainX, y: mainY, w: mainW };
        const interestsCount = data?.personalInfo?.interests?.split(/[·,]/).length ?? 1;
        mainY += interestsCount * 14 + 10;
      } else if (sectionId.startsWith("custom_")) {
        positions[`content_${sectionId}`] = { x: mainX, y: mainY, w: mainW };
        const cs = data?.customSections?.find((c) => `custom_${c.id}` === sectionId);
        mainY += Math.ceil((cs?.content.length ?? 60) / 60) * 13 + 15;
      }
    });
  });

  return positions;
}

/** Positions absolues par défaut (points) pour le Mode Canva */
export function getDefaultPositions(template: string, data?: CVData): Record<string, { x: number; y: number; w: number }> {
  if (data) {
    return computeDefaultPositions(template, data);
  }
  const isChaima = template === "chaima";
  if (isChaima) {
    return {
      photo: { x: 40, y: 24, w: 65 },
      title_contact: { x: 12, y: 95, w: 151 },
      content_contact: { x: 12, y: 112, w: 151 },
      title_skills: { x: 12, y: 230, w: 151 },
      title_languages: { x: 12, y: 400, w: 151 },
      content_languages: { x: 12, y: 417, w: 151 },
      title_education: { x: 12, y: 520, w: 151 },
      title_certifications: { x: 12, y: 650, w: 151 },
      content_certifications: { x: 12, y: 667, w: 151 },
      title_interests: { x: 12, y: 740, w: 151 },
      content_interests: { x: 12, y: 757, w: 151 },
      name: { x: 200, y: 20, w: 370 },
      role: { x: 200, y: 48, w: 370 },
      techLine: { x: 200, y: 66, w: 370 },
      title_summary: { x: 200, y: 95, w: 370 },
      content_summary: { x: 200, y: 112, w: 370 },
      title_experience: { x: 200, y: 210, w: 370 },
      title_projects: { x: 200, y: 550, w: 370 },
    };
  } else {
    return {
      name: { x: 24, y: 16, w: 450 },
      role: { x: 24, y: 46, w: 450 },
      techLine: { x: 24, y: 64, w: 450 },
      photo: getDefaultPhotoPosition("default", 165),
      title_contact: { x: 24, y: 95, w: 165 },
      content_contact: { x: 24, y: 112, w: 165 },
      title_skills: { x: 24, y: 230, w: 165 },
      title_languages: { x: 24, y: 400, w: 165 },
      content_languages: { x: 24, y: 417, w: 165 },
      title_education: { x: 24, y: 520, w: 165 },
      title_certifications: { x: 24, y: 650, w: 165 },
      content_certifications: { x: 24, y: 667, w: 165 },
      title_interests: { x: 24, y: 740, w: 165 },
      content_interests: { x: 24, y: 757, w: 165 },
      title_summary: { x: 212, y: 95, w: 360 },
      content_summary: { x: 212, y: 112, w: 360 },
      title_experience: { x: 212, y: 210, w: 360 },
      title_projects: { x: 212, y: 550, w: 360 },
    };
  }
}

export function getSectionBlockIds(sectionId: string, data: CVData): string[] {
  if (sectionId.startsWith("custom_")) {
    const exists = data.customSections?.some((c) => `custom_${c.id}` === sectionId);
    return exists ? [`title_${sectionId}`, `content_${sectionId}`] : [];
  }
  switch (sectionId) {
    case "contact": return ["title_contact", "content_contact"];
    case "summary": return ["title_summary", "content_summary"];
    case "languages": return ["title_languages", "content_languages"];
    case "certifications": return ["title_certifications", "content_certifications"];
    case "interests": return ["title_interests", "content_interests"];
    case "skills": return ["title_skills", ...data.skills.map((_, i) => `skill_${i}`)];
    case "education": return ["title_education", ...data.education.map((_, i) => `education_${i}`)];
    case "experience": return ["title_experience", ...data.experiences.map((_, i) => `experience_${i}`)];
    case "projects": return ["title_projects", ...data.projects.map((_, i) => `project_${i}`)];
    default: return [];
  }
}

export function getParentSectionId(blockId: string): string {
  if (blockId.startsWith("title_")) return blockId.substring(6);
  if (blockId.startsWith("content_")) return blockId.substring(8);
  if (blockId.startsWith("skill_")) return "skills";
  if (blockId.startsWith("experience_")) return "experience";
  if (blockId.startsWith("education_")) return "education";
  if (blockId.startsWith("project_")) return "projects";
  return blockId;
}
