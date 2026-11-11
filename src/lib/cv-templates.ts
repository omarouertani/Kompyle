import type { CVTheme } from "@/types/cv";

/**
 * Registre des modèles de CV.
 *
 * Un modèle = un MOTEUR de rendu (structure de page, positions par défaut,
 * renderers canvas et PDF) + un THÈME de départ (police, couleurs, mode des
 * compétences). Les trois moteurs existants couvrent les trois structures :
 *   - "classic"  : en-tête pleine largeur, colonne latérale à gauche, sans photo ;
 *   - "modern"   : colonne latérale avec photo, en-tête à droite ;
 *   - "canadian" : une seule colonne, sobre, sans photo (ATS).
 * Ajouter un modèle = ajouter une entrée ici (+ son libellé i18n
 * `CVPreview.template_<id>`). Le canvas, le PDF et les vignettes suivent.
 *
 * Ce fichier est importé côté client : il ne doit pas importer de composant
 * react-pdf (le choix du composant PDF par moteur vit dans la route PDF).
 */
export type TemplateEngine = "classic" | "modern" | "canadian";

export interface TemplateDef {
  /** Identifiant enregistré en base (`cv_profiles.template`). */
  id: string;
  engine: TemplateEngine;
  /** Thème de départ (CV vierge, vignette, changement de modèle). */
  theme: CVTheme;
  /** Vrai : choisir ce modèle applique son thème au CV. Faux pour les trois
   *  modèles historiques, dont la bascule n'a jamais touché au thème. */
  applyThemeOnSwitch: boolean;
}

export const TEMPLATES: readonly TemplateDef[] = [
  { id: "default", engine: "classic", theme: {}, applyThemeOnSwitch: false },
  {
    id: "modern",
    engine: "modern",
    theme: { primaryColor: "#fbbf24", sidebarBg: "#f4f4f5" },
    applyThemeOnSwitch: false,
  },
  { id: "canadian", engine: "canadian", theme: {}, applyThemeOnSwitch: false },
  {
    id: "elegant",
    engine: "classic",
    theme: {
      fontFamily: "merriweather",
      primaryColor: "#1e3a5f",
      textColor: "#1f2937",
      pageBg: "#fdfcf8",
      sidebarBg: "#f3efe6",
      skillMode: "text",
    },
    applyThemeOnSwitch: true,
  },
  {
    id: "minimal",
    engine: "classic",
    theme: {
      fontFamily: "lato",
      primaryColor: "#111827",
      textColor: "#374151",
      pageBg: "#ffffff",
      sidebarBg: "transparent",
      skillMode: "text",
    },
    applyThemeOnSwitch: true,
  },
  {
    id: "creative",
    engine: "modern",
    theme: {
      fontFamily: "poppins",
      primaryColor: "#0d9488",
      textColor: "#1f2937",
      pageBg: "#ffffff",
      sidebarBg: "#ecfdf5",
      skillMode: "bars",
    },
    applyThemeOnSwitch: true,
  },
  {
    id: "executive",
    engine: "modern",
    theme: {
      fontFamily: "sourcesans",
      primaryColor: "#7f1d1d",
      textColor: "#27272a",
      pageBg: "#ffffff",
      sidebarBg: "#f5f0eb",
      skillMode: "text",
    },
    applyThemeOnSwitch: true,
  },
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/** Modèle d'un identifiant enregistré. "chaima" est l'ancien nom de "modern" ;
 *  un identifiant inconnu retombe sur le modèle par défaut. */
export function getTemplateDef(id?: string | null): TemplateDef {
  const key = id === "chaima" ? "modern" : id || "default";
  return BY_ID.get(key) ?? TEMPLATES[0];
}

export const getTemplateEngine = (id?: string | null): TemplateEngine => getTemplateDef(id).engine;

/**
 * Thème après un changement de modèle `from` → `to`. On retire d'abord les
 * valeurs du thème de l'ancien modèle que l'utilisateur n'a pas modifiées,
 * puis on applique celui du nouveau. Les réglages propres à l'utilisateur
 * (tailles, couleurs de marque, récentes…) sont conservés.
 */
export function applyTemplateTheme(theme: CVTheme | undefined, from: string, to: string): CVTheme | undefined {
  const fromDef = getTemplateDef(from);
  const toDef = getTemplateDef(to);
  if (fromDef.id === toDef.id) return theme;
  if (!fromDef.applyThemeOnSwitch && !toDef.applyThemeOnSwitch) return theme;
  const next: CVTheme = { ...theme };
  if (fromDef.applyThemeOnSwitch) {
    for (const key of Object.keys(fromDef.theme) as (keyof CVTheme)[]) {
      if (next[key] === fromDef.theme[key]) delete next[key];
    }
  }
  if (toDef.applyThemeOnSwitch) Object.assign(next, toDef.theme);
  return next;
}
