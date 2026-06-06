import { Font } from "@react-pdf/renderer";

/**
 * Système de polices PDF de Kompyle — version chirurgicale de la logique
 * `registerFonts` de Reactive Resume (packages/pdf + packages/fonts).
 *
 * On conserve leurs 4 idées de robustesse (idempotence, skip des polices
 * standard, poids minimaux, source par poids) et on jette tout le reste
 * (CJK, registre de 1000 polices, schéma couplé).
 *
 * À propos de l'« async » : react-pdf charge les polices LUI-MÊME. Donner une
 * URL à `Font.register` déclenche un fetch au rendu, et le renderer attend que
 * la police soit prête avant de produire le PDF. La fiabilité vient donc de la
 * façon d'enregistrer (idempotent, bon poids, bonne source), pas d'un
 * chargement manuel.
 */

export interface PdfFontVariant {
  /** URL .ttf (gstatic…) OU chemin local sous /public (ex: "/fonts/calibri.ttf"). */
  src: string;
  fontWeight?: number | "normal" | "bold";
  fontStyle?: "normal" | "italic";
}

export interface PdfFontDefinition {
  family: string;
  fonts: PdfFontVariant[];
}

/**
 * Registre des polices disponibles.
 *
 *  • Calibri  → fichiers locaux (/public/fonts) : 100 % fiable, hors-ligne.
 *  • Inter / Roboto / Carlito → .ttf Google Fonts (gstatic), fetchés async par
 *    react-pdf au rendu (gstatic renvoie `access-control-allow-origin: *`, donc
 *    OK côté navigateur). Pour une fiabilité maximale hors-ligne, télécharge ces
 *    .ttf dans /public/fonts et remplace l'URL par le chemin local.
 *  • Carlito  → clone MÉTRIQUE-compatible de Calibri (substitut utilisé par RR) :
 *    rendu quasi identique à ton Calibri, mais servi par une URL stable.
 *
 * On n'enregistre que 400 (regular) et 700 (bold) — les seuls poids utilisés par
 * le template. PDF plus léger, rendu plus rapide (philosophie RR).
 */
export const PDF_FONTS = {
  Calibri: {
    family: "Calibri",
    fonts: [
      { src: "/fonts/calibri.ttf", fontWeight: 400 },
      { src: "/fonts/calibrib.ttf", fontWeight: 700 },
    ],
  },
  Inter: {
    family: "Inter",
    fonts: [
      {
        src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf",
        fontWeight: 400,
      },
      {
        src: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf",
        fontWeight: 700,
      },
    ],
  },
  Roboto: {
    family: "Roboto",
    fonts: [
      {
        src: "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmTggvWl0Qn.ttf",
        fontWeight: 400,
      },
      {
        src: "https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWuYjammTggvWl0Qn.ttf",
        fontWeight: 700,
      },
    ],
  },
  Carlito: {
    family: "Carlito",
    fonts: [
      { src: "https://fonts.gstatic.com/s/carlito/v4/3Jn9SDPw3m-pk039DDeBSQ.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/carlito/v4/3Jn4SDPw3m-pk039BIykWXolVg.ttf", fontWeight: 700 },
    ],
  },
} satisfies Record<string, PdfFontDefinition>;

export type PdfFontFamily = keyof typeof PDF_FONTS;

/**
 * Police active du document. ⬅️ UN SEUL point à changer pour basculer toute la
 * typographie : le thème (components/pdf-primitives/theme.tsx) lit cette valeur,
 * et la primitive <Page> l'injecte globalement.
 */
export const ACTIVE_PDF_FONT: PdfFontFamily = "Carlito";

/** Polices intégrées au standard PDF : ne jamais les enregistrer. */
const STANDARD_PDF_FONTS = new Set<string>(["Helvetica", "Courier", "Times-Roman"]);

/**
 * Garde d'idempotence : `Font.register` est rappelé à chaque re-render React.
 * On n'enregistre chaque famille qu'une seule fois (évite rechargements et bugs
 * de rendu « font not found »).
 */
const registeredFamilies = new Set<string>();
let hyphenationConfigured = false;

function configureHyphenation(): void {
  if (hyphenationConfigured) return;
  // Désactive la césure : un mot trop long bascule ENTIER à la ligne suivante
  // (complémentaire des zero-width-spaces injectés par wrapText dans le template).
  Font.registerHyphenationCallback((word) => [word]);
  hyphenationConfigured = true;
}

/**
 * Enregistre une famille de police de façon idempotente et sûre, puis renvoie
 * le nom de famille à utiliser (pour le thème / les styles).
 *
 * Robustesse :
 *   - configure la césure une seule fois ;
 *   - ignore les polices standard du PDF ;
 *   - ne ré-enregistre jamais une famille déjà chargée ;
 *   - sur famille inconnue : avertit en dev et retombe sur Helvetica (pas de crash).
 */
export function registerPdfFont(family: PdfFontFamily | string = ACTIVE_PDF_FONT): string {
  configureHyphenation();

  if (STANDARD_PDF_FONTS.has(family)) return family;
  if (registeredFamilies.has(family)) return family;

  const definition = PDF_FONTS[family as PdfFontFamily];
  if (!definition) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[pdf-fonts] Police « ${family} » absente du registre — fallback Helvetica.`);
    }
    return "Helvetica";
  }

  Font.register(definition);
  registeredFamilies.add(definition.family);
  return definition.family;
}
