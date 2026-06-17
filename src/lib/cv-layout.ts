import type { CVData, CVLayout, LayoutPage, SectionId } from "@/types/cv";

/** Clés de template connues. "modern" remplace l'ancien "chaima" (conservé en
 *  alias pour les anciennes lignes en base). "canadian" = CV sobre nord-américain. */
export type TemplateKey = "default" | "modern" | "canadian";

/** Vrai pour le template "Moderne" (anciennement nommé "chaima"). On accepte
 *  encore l'ancien identifiant pour les CV déjà enregistrés en base. */
export const isModernTemplate = (template: string): boolean =>
  template === "modern" || template === "chaima";

/** Vrai pour le template "Canadien" : CV sobre, sans photo, mono-colonne,
 *  optimisé pour la lecture par les logiciels ATS. */
export const isCanadianTemplate = (template: string): boolean =>
  template === "canadian";

/** Normalise un identifiant de template legacy vers la nouvelle clé. */
export const normalizeTemplate = (template?: string | null): string =>
  template === "chaima" ? "modern" : template || "default";

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

/**
 * Libellés de sections en anglais, formulés EXACTEMENT comme les en-têtes que
 * les ATS anglophones recherchent ("Experience", "Education", "Skills"…).
 * Utilisé par /api/adapt-cv pour aligner les titres de section sur la langue de
 * l'offre quand celle-ci est en anglais (un en-tête "Éducation" n'est pas
 * reconnu comme "Education" par l'ATS → section considérée manquante).
 */
export const SECTION_LABELS_EN: Record<SectionId, string> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  contact: "Contact",
  skills: "Skills",
  languages: "Languages",
  education: "Education",
  certifications: "Certifications",
  interests: "Interests",
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

/**
 * Layout du CV canadien (nord-américain) : une SEULE colonne pleine largeur,
 * sections empilées de haut en bas dans l'ordre attendu par les recruteurs et
 * les ATS canadiens — Résumé professionnel, Compétences clés, Expériences,
 * Éducation. Aucune barre latérale, aucune photo. Les coordonnées (téléphone,
 * email, LinkedIn, ville/province) sont rendues dans l'en-tête via le bloc
 * `contactLine`, pas dans une section dédiée.
 */
export function canadianLayout(): CVLayout {
  return {
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    pages: [
      {
        sidebar: [],
        main: ["summary", "skills", "experience", "education"],
      },
    ],
    sectionTitles: {
      summary: "Résumé professionnel",
      skills: "Compétences clés",
      experience: "Expériences professionnelles",
      education: "Éducation",
    },
    theme: { skillMode: "text" },
  };
}

/** Vrai si le layout est mono-colonne (signature du CV canadien) : aucune
 *  section en barre latérale sur l'ensemble des pages. */
export function isCanadianLayout(layout: CVLayout): boolean {
  return layout.pages.length > 0 && layout.pages.every((p) => p.sidebar.length === 0);
}

/**
 * Aligne la structure du layout sur le template choisi lors d'un changement de
 * modèle. Le passage de/vers le CV canadien change radicalement la mise en page
 * (mono-colonne ↔ deux colonnes) : on réinitialise la structure des pages tout
 * en préservant le thème et les titres de sections renommés. Les positions
 * absolues éventuelles sont effacées (elles n'ont plus de sens dans la nouvelle
 * structure). Les bascules entre templates de MÊME structure (default ↔ modern)
 * ne touchent à rien.
 */
export function migrateLayoutForTemplate(data: CVData, template: string): CVData {
  const layout = data.layout ?? defaultLayout();
  const wantsCanadian = isCanadianTemplate(template);
  const isCanadian = isCanadianLayout(layout);

  if (wantsCanadian === isCanadian) return data;

  const base = wantsCanadian ? canadianLayout() : defaultLayout();
  return {
    ...data,
    layout: {
      ...base,
      theme: layout.theme ?? base.theme,
      sectionTitles: { ...base.sectionTitles, ...layout.sectionTitles },
    },
  };
}

/** Page de layout vide (pour l'ajout de page en Phase C). */
export function emptyLayoutPage(): LayoutPage {
  return { main: [], sidebar: [] };
}

/**
 * Dé-duplique les références de sections dans les pages : chaque id de section
 * ne doit apparaître qu'UNE fois (sur une seule page, une seule colonne).
 * La 1re occurrence l'emporte. Évite les clés React dupliquées et les blocs
 * empilés (positions recalculées deux fois pour le même id).
 */
export function dedupePages(pages: LayoutPage[]): LayoutPage[] {
  const seen = new Set<string>();
  const keepUnseen = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  };
  return pages.map((p) => ({
    main: p.main.filter(keepUnseen),
    sidebar: p.sidebar.filter(keepUnseen),
  }));
}

/** Vrai si au moins un id de section est référencé plusieurs fois. */
export function hasDuplicateSections(pages: LayoutPage[]): boolean {
  const seen = new Set<string>();
  for (const p of pages) {
    for (const id of [...p.main, ...p.sidebar]) {
      if (seen.has(id)) return true;
      seen.add(id);
    }
  }
  return false;
}

/**
 * CV vierge — utilisé quand la base de données est indisponible (plus aucune
 * donnée codée en dur : les profils réels vivent en BD). L'utilisateur peut
 * éditer ce squelette ou repartir d'un template.
 */
export function emptyCV(template = "default"): CVData {
  return {
    personalInfo: {
      name: "",
      role: "",
      techLine: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      summary: "",
    },
    skills: [],
    spokenLanguages: [],
    education: [],
    experiences: [],
    projects: [],
    layout: isCanadianTemplate(template)
      ? canadianLayout()
      : { ...defaultLayout(), theme: isModernTemplate(template) ? { primaryColor: "#fbbf24", sidebarBg: "#f4f4f5" } : {} },
  };
}

// ─── Sections personnalisées ──────────────────────────────────────────────

/** Libellé d'une section, built-in ou personnalisée.
 *  Priorité au renommage utilisateur (layout.sectionTitles) pour les built-in. */
export function getSectionLabel(sectionId: string, data?: CVData): string {
  if (sectionId.startsWith("custom_")) {
    const cs = data?.customSections?.find((c) => `custom_${c.id}` === sectionId);
    return cs?.title || "Section personnalisée";
  }
  const override = data?.layout?.sectionTitles?.[sectionId];
  return override ?? SECTION_LABELS[sectionId as SectionId] ?? sectionId;
}

/** Renomme une section (built-in via sectionTitles, custom via customSections). */
export function renameSection(data: CVData, sectionId: string, title: string): CVData {
  if (sectionId.startsWith("custom_")) {
    return {
      ...data,
      customSections: (data.customSections ?? []).map((c) =>
        `custom_${c.id}` === sectionId ? { ...c, title } : c
      ),
    };
  }
  const layout = data.layout ?? defaultLayout();
  return {
    ...data,
    layout: { ...layout, sectionTitles: { ...layout.sectionTitles, [sectionId]: title } },
  };
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
    else if (id === "techLine" || id === "contactLine") h = 14;

    maxBottom = Math.max(maxBottom, pos.y + h);
  }

  return maxBottom + 20;
}

/** Position photo alignée sur le mode colonnes (sidebar, pas coin haut-droit). */
export function getDefaultPhotoPosition(
  template: string,
  sidebarWidth = DEFAULT_SIDEBAR_WIDTH
): { x: number; y: number; w: number } {
  if (isModernTemplate(template)) {
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
  const isChaima = isModernTemplate(template);
  const isCanadian = isCanadianTemplate(template);
  const layout: Partial<CVLayout> = data?.layout ?? {};
  const sidebarWidth = layout.sidebarWidth ?? (isChaima ? 175 : 165);
  const defaultPages: LayoutPage[] = isCanadian
    ? canadianLayout().pages
    : [{ sidebar: ["contact", "skills", "languages", "education"], main: ["summary", "experience", "projects"] }];
  const pages: LayoutPage[] = layout.pages ?? defaultPages;

  // Pleine largeur de contenu (page A4 moins les marges latérales de 24 pt).
  const CANADIAN_X = 24;
  const CANADIAN_W = 547;

  const positions: Record<string, { x: number; y: number; w: number }> = {};

  // Default header heights — alignés sur le rendu colonnes / PDF
  if (isCanadian) {
    // En-tête minimaliste : nom + titre + ligne de coordonnées (pas de photo).
    positions["name"] = { x: CANADIAN_X, y: 12, w: CANADIAN_W };
    positions["role"] = { x: CANADIAN_X, y: 44, w: CANADIAN_W };
    positions["contactLine"] = { x: CANADIAN_X, y: 64, w: CANADIAN_W };
  } else if (isChaima) {
    positions["photo"] = getDefaultPhotoPosition("modern", sidebarWidth);
    positions["name"] = { x: 200, y: 20, w: 370 };
    positions["role"] = { x: 200, y: 48, w: 370 };
    positions["techLine"] = { x: 200, y: 66, w: 370 };
  } else {
    // Classique « sans photo » : en-tête pleine largeur, aucune photo.
    positions["name"] = { x: 24, y: 12, w: 547 };
    positions["role"] = { x: 24, y: 42, w: 547 };
    positions["techLine"] = { x: 24, y: 60, w: 547 };
  }

  // Iterate through pages
  pages.forEach((page, pageIndex) => {
    // Stack sidebar:
    // Marges internes (gauche/droite) pour que le contenu reste CONTENU dans la
    // largeur de la barre latérale (et son fond) au lieu de déborder à droite.
    // Classique et moderne alignés sur le même principe d'encart.
    let sidebarY = pageIndex === 0 ? (isChaima ? 100 : 95) : 20;
    const sidebarX = isChaima ? 12 : 16;
    const sidebarW = isChaima ? sidebarWidth - 24 : sidebarWidth - 32;

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
    const mainX = isCanadian ? CANADIAN_X : isChaima ? sidebarWidth + 20 : sidebarWidth + 30;
    const mainW = isCanadian ? CANADIAN_W : isChaima ? 595 - sidebarWidth - 35 : 595 - sidebarWidth - 54;

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

/**
 * Reflow des positions à partir des hauteurs RÉELLES des blocs.
 *
 * `computeDefaultPositions` empile les blocs avec des hauteurs *estimées*
 * (ex : `Math.ceil(len / 60) * 13`). Dès que le contenu change de longueur
 * (typiquement après une adaptation IA), ces estimations dérivent et les
 * sections se chevauchent. Cette fonction réutilise les colonnes (x / largeur)
 * de `computeDefaultPositions` mais recalcule les `y` en empilant chaque bloc
 * sous le précédent selon sa hauteur MESURÉE dans le DOM — zéro chevauchement,
 * quelle que soit la longueur du texte.
 *
 * `measureHeightPt(blockId)` doit renvoyer la hauteur réelle du bloc en points
 * (offsetHeight / PT_TO_PX), ou `null` si le bloc n'est pas dans le DOM.
 */
export function computeFlowPositions(
  template: string,
  data: CVData,
  measureHeightPt: (blockId: string) => number | null
): Record<string, { x: number; y: number; w: number; h?: number }> {
  const base = computeDefaultPositions(template, data);
  const positions: Record<string, { x: number; y: number; w: number; h?: number }> = {};
  for (const [k, v] of Object.entries(base)) positions[k] = { ...v };

  const isChaima = isModernTemplate(template);
  const isCanadian = isCanadianTemplate(template);
  const layout = data.layout ?? defaultLayout();
  const BLOCK_GAP = 3; // espacement entre blocs d'une même section (pt)
  // Espacement entre sections : piloté par le thème (slider "Espacement des sections")
  const SECTION_GAP = layout.theme?.sectionMargin ?? 8;

  const stackColumn = (sectionIds: string[], startY: number) => {
    let y = startY;
    sectionIds.forEach((sectionId) => {
      const blockIds = getSectionBlockIds(sectionId, data);
      blockIds.forEach((blockId) => {
        if (!positions[blockId]) return;
        positions[blockId] = { ...positions[blockId], y: Math.round(y), h: undefined };
        const h = measureHeightPt(blockId);
        y += (h ?? 20) + BLOCK_GAP;
      });
      if (blockIds.length > 0) y += SECTION_GAP - BLOCK_GAP;
    });
  };

  // En-tête : empilé par hauteur mesurée. Sans ça, un nom ou un titre sur 2
  // lignes chevauche la ligne suivante. Le CV canadien remplace techLine par
  // la ligne de coordonnées (contactLine).
  let headerY = positions["name"]?.y ?? (isChaima ? 20 : 12);
  for (const id of getHeaderStackIds(isCanadian)) {
    if (!positions[id]) continue;
    positions[id] = { ...positions[id], y: Math.round(headerY), h: undefined };
    const h = measureHeightPt(id);
    headerY += (h ?? 16) + 3;
  }

  layout.pages.forEach((page, pageIndex) => {
    const startY = pageIndex === 0 ? (isChaima ? 100 : 95) : 20;
    stackColumn(page.sidebar, startY);
    stackColumn(page.main, startY);
  });

  return positions;
}

/** Sections présentes dans chaque colonne, dans l'ordre, dédupliquées sur
 *  l'ensemble des pages. Sert de source d'ordre unique pour la pagination. */
export function getColumnSections(layout: CVLayout): { sidebar: string[]; main: string[] } {
  const sidebar: string[] = [];
  const main: string[] = [];
  for (const page of layout.pages) {
    for (const s of page.sidebar) if (!sidebar.includes(s)) sidebar.push(s);
    for (const s of page.main) if (!main.includes(s)) main.push(s);
  }
  return { sidebar, main };
}

/**
 * Pagination au niveau BLOC à partir des hauteurs RÉELLES mesurées.
 *
 * Empile chaque colonne (sidebar / main) en partant du haut de la page 1 ;
 * dès qu'un bloc dépasserait le bas de la page A4 utilisable, il (et les
 * suivants) basculent sur une nouvelle page, `y` repart en haut. La page de
 * chaque bloc est stockée dans `position.page`. Garantit qu'AUCUN bloc ne
 * dépasse la hauteur d'une page → plus de boucle infinie au rendu PDF.
 */
export function computePaginatedFlow(
  template: string,
  data: CVData,
  measureHeightPt: (blockId: string) => number | null
): { positions: Record<string, { x: number; y: number; w: number; h?: number; page: number }>; pageCount: number } {
  const base = computeDefaultPositions(template, data);
  const positions: Record<string, { x: number; y: number; w: number; h?: number; page: number }> = {};
  for (const [k, v] of Object.entries(base)) positions[k] = { ...v, page: 0 };

  const isChaima = isModernTemplate(template);
  const isCanadian = isCanadianTemplate(template);
  const layout = data.layout ?? defaultLayout();
  const { sidebar: sidebarSections, main: mainSections } = getColumnSections(layout);

  const BLOCK_GAP = 3;
  // Espacement entre sections : piloté par le thème (slider "Espacement des sections")
  const SECTION_GAP = layout.theme?.sectionMargin ?? 8;
  // Plancher de compression : pour faire tenir un CV sur UNE seule page, on
  // resserre l'espacement inter-sections jusqu'à cette valeur avant d'accepter
  // un saut de page. On privilégie un document compact mais aéré.
  const MIN_SECTION_GAP = 4;
  const FIRST_START = isChaima ? 100 : 95; // sous le header / la photo
  const NEXT_START = 24; // haut des pages suivantes
  const PAGE_BOTTOM = A4_PAGE_HEIGHT_PT - 24; // marge basse
  // Tolérance de débordement : un dépassement inférieur à ce seuil ne déclenche
  // PAS de saut de page (évite d'exiler une section pour quelques points).
  const OVERFLOW_TOL = 16;

  // En-tête (page 0 uniquement) : empilé par hauteur mesurée.
  let headerY = positions["name"]?.y ?? (isChaima ? 20 : 12);
  for (const id of getHeaderStackIds(isCanadian)) {
    if (!positions[id]) continue;
    positions[id] = { ...positions[id], y: Math.round(headerY), h: undefined, page: 0 };
    headerY += (measureHeightPt(id) ?? 16) + 3;
  }
  if (positions["photo"]) positions["photo"].page = 0;

  let maxPage = 0;

  const paginate = (sectionIds: string[]) => {
    const blocks: { id: string; h: number }[] = [];
    sectionIds.forEach((sectionId) => {
      getSectionBlockIds(sectionId, data).forEach((id) => {
        if (positions[id]) blocks.push({ id, h: measureHeightPt(id) ?? 20 });
      });
    });
    if (blocks.length === 0) return;

    // Espace AVANT le bloc i : marge de section si on change de section, sinon
    // simple interligne de bloc. Le 1er bloc n'a pas de marge supérieure.
    const gapBefore = (i: number, sectionGap: number) => {
      if (i === 0) return 0;
      return getParentSectionId(blocks[i].id) !== getParentSectionId(blocks[i - 1].id) ? sectionGap : BLOCK_GAP;
    };
    const columnHeight = (sectionGap: number) => {
      let h = 0;
      for (let i = 0; i < blocks.length; i++) h += gapBefore(i, sectionGap) + blocks[i].h;
      return h;
    };

    const capacityFirst = PAGE_BOTTOM - FIRST_START;

    // Compression adaptative : si la colonne déborde d'une page, on resserre
    // l'espacement inter-sections (jusqu'à MIN_SECTION_GAP) pour tenter de
    // rester sur une seule page avant de paginer.
    let sectionGap = SECTION_GAP;
    if (columnHeight(sectionGap) > capacityFirst + OVERFLOW_TOL && sectionGap > MIN_SECTION_GAP) {
      let best = MIN_SECTION_GAP;
      for (let g = sectionGap; g >= MIN_SECTION_GAP; g--) {
        if (columnHeight(g) <= capacityFirst) { best = g; break; }
      }
      sectionGap = best;
    }

    const fitsOnePage = columnHeight(sectionGap) <= capacityFirst + OVERFLOW_TOL;

    let page = 0;
    let y = FIRST_START;
    const startOf = (p: number) => (p === 0 ? FIRST_START : NEXT_START);

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const gb = gapBefore(i, sectionGap);

      // Saut de page uniquement si la colonne ne tient PAS sur une page.
      if (!fitsOnePage) {
        const isTitle = b.id.startsWith("title_");
        // Anti-orphelin : un titre entraîne le bloc suivant sur la même page.
        let needed = gb + b.h;
        if (isTitle && i + 1 < blocks.length) needed += BLOCK_GAP + blocks[i + 1].h;

        if (y + needed > PAGE_BOTTOM + OVERFLOW_TOL && y > startOf(page)) {
          page++;
          y = NEXT_START;
          positions[b.id] = { ...positions[b.id], y: Math.round(y), h: undefined, page };
          y += b.h;
          continue; // pas de marge supérieure en tête de page
        }
      }

      y += gb;
      positions[b.id] = { ...positions[b.id], y: Math.round(y), h: undefined, page };
      y += b.h;
    }
    maxPage = Math.max(maxPage, page);
  };

  paginate(sidebarSections);
  paginate(mainSections);

  return { positions, pageCount: maxPage + 1 };
}

/** IDs de blocs (titre + items) à rendre pour une page donnée, par colonne.
 *  En mode `autoPaginated`, filtre par `position.page` ; sinon, conserve le
 *  modèle historique section→page de `layout.pages`. Source unique pour le
 *  canvas ET le rendu PDF. */
export function getPageBlockIds(
  layout: CVLayout,
  data: CVData,
  pageIndex: number
): { sidebar: string[]; main: string[] } {
  const positions = layout.absolutePositions ?? {};
  if (layout.autoPaginated) {
    const pageOf = (b: string) => positions[b]?.page ?? 0;
    const { sidebar, main } = getColumnSections(layout);
    return {
      sidebar: sidebar.flatMap((s) => getSectionBlockIds(s, data)).filter((b) => pageOf(b) === pageIndex),
      main: main.flatMap((s) => getSectionBlockIds(s, data)).filter((b) => pageOf(b) === pageIndex),
    };
  }
  // Mode pages : page d'accueil = page de la section, surchargée par bloc via
  // position.page (déplacement individuel d'un élément vers une autre page).
  const pages = dedupePages(layout.pages);
  const pageOf = (b: string, home: number) => {
    const ov = positions[b]?.page;
    return ov !== undefined && ov >= 0 && ov < pages.length ? ov : home;
  };
  const sidebar: string[] = [];
  const main: string[] = [];
  pages.forEach((pg, pi) => {
    for (const s of pg.sidebar) {
      for (const b of getSectionBlockIds(s, data)) {
        if (pageOf(b, pi) === pageIndex) sidebar.push(b);
      }
    }
    for (const s of pg.main) {
      for (const b of getSectionBlockIds(s, data)) {
        if (pageOf(b, pi) === pageIndex) main.push(b);
      }
    }
  });
  return { sidebar, main };
}

/** Positions absolues par défaut (points) pour le Mode Canva */
export function getDefaultPositions(template: string, data?: CVData): Record<string, { x: number; y: number; w: number }> {
  if (data) {
    return computeDefaultPositions(template, data);
  }
  if (isCanadianTemplate(template)) {
    return {
      name: { x: 24, y: 12, w: 547 },
      role: { x: 24, y: 44, w: 547 },
      contactLine: { x: 24, y: 64, w: 547 },
      title_summary: { x: 24, y: 95, w: 547 },
      content_summary: { x: 24, y: 112, w: 547 },
      title_skills: { x: 24, y: 200, w: 547 },
      title_experience: { x: 24, y: 320, w: 547 },
      title_education: { x: 24, y: 600, w: 547 },
    };
  }
  const isChaima = isModernTemplate(template);
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
      name: { x: 24, y: 16, w: 547 },
      role: { x: 24, y: 46, w: 547 },
      techLine: { x: 24, y: 64, w: 547 },
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

/** Ids des blocs d'en-tête empilés verticalement sur la page 0, dans l'ordre.
 *  Le CV canadien remplace la ligne « technologies » (techLine) par une ligne
 *  de coordonnées (contactLine) — convention nord-américaine. */
export function getHeaderStackIds(isCanadian: boolean): string[] {
  return isCanadian ? ["name", "role", "contactLine"] : ["name", "role", "techLine"];
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
