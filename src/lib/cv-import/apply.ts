import type { CVData, CVLayout, LayoutPage } from "@/types/cv";
import { ALL_SECTION_IDS, defaultLayout, dedupePages } from "@/lib/cv-layout";
import { bakeFreeElementPositions } from "@/lib/free-elements";
import { mockCV } from "@/lib/mock-cv";
import type { ImportedCV } from "./schema";

/** Sections qui vont dans la colonne latérale quand on doit les ajouter au layout. */
const SIDEBAR_SECTIONS = new Set(["contact", "skills", "languages", "education", "certifications", "interests"]);
const BUILT_IN_SECTIONS = new Set<string>(ALL_SECTION_IDS);

/** Vrai si le CV affiché est encore le CV d'exemple (Jane Doe), même partiellement modifié. */
export function isSampleCV(cv: CVData): boolean {
  const sample = mockCV().personalInfo;
  const pi = cv.personalInfo;
  return pi.email === sample.email || pi.linkedin === sample.linkedin || pi.phone === sample.phone;
}

/** Sections built-in qui ont du contenu dans le CV importé. */
function filledSections(cv: ImportedCV): string[] {
  const pi = cv.personalInfo;
  const ids: string[] = [];
  if (pi.summary) ids.push("summary");
  if (cv.experiences.length) ids.push("experience");
  if (cv.projects.length) ids.push("projects");
  if (pi.email || pi.phone || pi.location || pi.linkedin || pi.portfolio) ids.push("contact");
  if (cv.skills.length) ids.push("skills");
  if (cv.spokenLanguages.length) ids.push("languages");
  if (cv.education.length) ids.push("education");
  if (pi.certifications) ids.push("certifications");
  if (pi.interests) ids.push("interests");
  return ids;
}

/**
 * Structure de pages pour le CV importé : on garde l'ordre et les colonnes
 * choisis par l'utilisateur, ramenés sur UNE page (la pagination automatique
 * du canvas redécoupe selon les hauteurs réelles du nouveau contenu), sans les
 * anciennes sections libres, et on ajoute les sections remplies qui étaient
 * masquées — sinon une partie du CV importé serait invisible.
 */
function importedPages(layout: CVLayout, cv: ImportedCV): LayoutPage[] {
  const pages = dedupePages(layout.pages.length ? layout.pages : defaultLayout().pages);
  const filled = filledSections(cv);
  // Sections gardées : pas les anciennes sections libres, ni les sections
  // intégrées restées VIDES après l'import (un titre « Projets » sans contenu).
  // Le contact reste toujours : c'est le repère de la colonne latérale.
  const keep = (id: string) =>
    !id.startsWith("custom_") && (id === "contact" || !BUILT_IN_SECTIONS.has(id) || filled.includes(id));
  const page: LayoutPage = {
    main: pages.flatMap((p) => p.main).filter(keep),
    sidebar: pages.flatMap((p) => p.sidebar).filter(keep),
  };
  const singleColumn = pages.every((p) => p.sidebar.length === 0);
  const present = new Set([...page.main, ...page.sidebar]);
  for (const id of filled) {
    if (present.has(id)) continue;
    // Le CV canadien (une colonne) rend le contact dans l'en-tête.
    if (singleColumn && id === "contact") continue;
    if (!singleColumn && SIDEBAR_SECTIONS.has(id)) page.sidebar.push(id);
    else page.main.push(id);
  }
  page.main.push(...(cv.customSections ?? []).map((c) => `custom_${c.id}`));
  return [page];
}

/**
 * Remplace TOUT le contenu du CV courant par le CV importé — aucune donnée
 * d'exemple ne survit (contact, résumé, expériences, compétences, langues,
 * formations, projets, certifications, intérêts, sections libres). On garde ce
 * qui relève de la présentation choisie par l'utilisateur : thème, titres de
 * sections, largeur de colonne, format de page, éléments libres (repositionnés)
 * et photo. Les positions absolues sont effacées : le canvas recalcule une mise
 * en page propre à partir des hauteurs réelles.
 */
export function applyImportedCV(current: CVData, imported: ImportedCV): CVData {
  const layout = current.layout ?? defaultLayout();
  return {
    personalInfo: {
      ...imported.personalInfo,
      ...(current.personalInfo.photo ? { photo: current.personalInfo.photo } : {}),
    },
    skills: imported.skills,
    spokenLanguages: imported.spokenLanguages,
    education: imported.education,
    experiences: imported.experiences,
    projects: imported.projects,
    customSections: imported.customSections ?? [],
    layout: {
      ...layout,
      pages: importedPages(layout, imported),
      freeElements: bakeFreeElementPositions(layout),
      absolutePositions: undefined,
      useAbsolutePositioning: undefined,
      autoPaginated: false,
    },
  };
}
