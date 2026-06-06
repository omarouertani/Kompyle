import type { CVLayout, LayoutPage, SectionId } from "@/types/cv";

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
