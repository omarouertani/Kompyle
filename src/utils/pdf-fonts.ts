import { Font } from "@react-pdf/renderer";
import type { CVFontFamily } from "@/types/cv";

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
      // Italic variants — required so the user toggling italic on a selection
      // doesn't crash the render (react-pdf throws if a used variant is unregistered).
      // Inter ships a single variable italic file; we point both weights at it.
      {
        src: "https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dtRipWA.ttf",
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: "https://fonts.gstatic.com/s/inter/v20/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dtRipWA.ttf",
        fontWeight: 700,
        fontStyle: "italic",
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
      {
        src: "https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLoHQiA8.ttf",
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: "https://fonts.gstatic.com/s/roboto/v51/KFOKCnqEu92Fr1Mu53ZEC9_Vu3r1gIhOszmOClHrs6ljXfMMLmbXiA8.ttf",
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  },
  Carlito: {
    family: "Carlito",
    fonts: [
      { src: "https://fonts.gstatic.com/s/carlito/v4/3Jn9SDPw3m-pk039DDeBSQ.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/carlito/v4/3Jn4SDPw3m-pk039BIykWXolVg.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/carlito/v4/3Jn_SDPw3m-pk039DDKBSQ.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/carlito/v4/3Jn6SDPw3m-pk039DDK59XglVg.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  // ── Pack pro (synchronisé avec next/font côté canvas, cf. layout.tsx) ──────
  // Toutes en .ttf statiques gstatic (mêmes métriques que la webfont canvas).
  Lato: {
    family: "Lato",
    fonts: [
      { src: "https://fonts.gstatic.com/s/lato/v25/S6uyw4BMUTPHvxk6WQev.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/lato/v25/S6u9w4BMUTPHh6UVew-FHi_o.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/lato/v25/S6u8w4BMUTPHjxswWyWtFCc.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/lato/v25/S6u_w4BMUTPHjxsI5wqPHA3q5d0.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Montserrat: {
    family: "Montserrat",
    fonts: [
      { src: "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-Y31cow.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-Y31cow.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R9aX9-obK4.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq0N6aX9-obK4.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Poppins: {
    family: "Poppins",
    fonts: [
      { src: "https://fonts.gstatic.com/s/poppins/v24/pxiEyp8kv8JHgFVrFJDUdVNF.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLCz7V1tvEv-L.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/poppins/v24/pxiGyp8kv8JHgFVrJJLed3FHGPc.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/poppins/v24/pxiDyp8kv8JHgFVrJJLmy15lEN2JQEk.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  "Open Sans": {
    family: "Open Sans",
    fonts: [
      { src: "https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0C4nY1U2xQ.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/opensans/v44/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsg-1y4nY1U2xQ.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/opensans/v44/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0Rk8ZkaVcUx6EQ.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/opensans/v44/memQYaGs126MiZpBA-UFUIcVXSCEkx2cmqvXlWq8tWZ0Pw86hd0RkyFjaVcUx6EQ.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  "Source Sans 3": {
    family: "Source Sans 3",
    fonts: [
      { src: "https://fonts.gstatic.com/s/sourcesans3/v19/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Ky461EN_iw6nw.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/sourcesans3/v19/nwpBtKy2OAdR1K-IwhWudF-R9QMylBJAV3Bo8Kxf7FEN_iw6nw.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/sourcesans3/v19/nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqLlO9C4YnYfA.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/sourcesans3/v19/nwpDtKy2OAdR1K-IwhWudF-R3woAa8opPOrG97lwqF5J9C4YnYfA.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Merriweather: {
    family: "Merriweather",
    fonts: [
      { src: "https://fonts.gstatic.com/s/merriweather/v33/u-4D0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiScCmDxhtNOKl8yDr3icqE1fyKvQ.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/merriweather/v33/u-4D0qyriQwlOrhSvowK_l5UcA6zuSYEqOzpPe3HOZJ5eX1WtLaQwmYiScCmDxhtNOKl8yDrOSAqE1fyKvQ.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/merriweather/v33/u-4B0qyriQwlOrhSvowK_l5-eTxCVx0ZbwLvKH2Gk9hLmp0v5yA-xXPqCzLvPee1XYk_XSf-FmTCUF3wCPbaYA.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/merriweather/v33/u-4B0qyriQwlOrhSvowK_l5-eTxCVx0ZbwLvKH2Gk9hLmp0v5yA-xXPqCzLvPee1XYk_XSf-FmQlV13wCPbaYA.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  "Playfair Display": {
    family: "Playfair Display",
    fonts: [
      { src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQZNTo_A.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQZNTo_A.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtbK_l2q.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/playfairdisplay/v40/nuFRD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_k-UbtbK_l2q.ttf", fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Gelasio: {
    family: "Gelasio",
    fonts: [
      { src: "https://fonts.gstatic.com/s/gelasio/v14/cIfiMaFfvUQxTTqS3iKJkLGbI41wQL8Ilycs-TbO8Q.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/gelasio/v14/cIfiMaFfvUQxTTqS3iKJkLGbI41wQL_vkCcs-TbO8Q.ttf", fontWeight: 700 },
      { src: "https://fonts.gstatic.com/s/gelasio/v14/cIfsMaFfvUQxTTqS9Cu7b2nySBfeR6rA1M9v8zTs8xbb.ttf", fontWeight: 400, fontStyle: "italic" },
      { src: "https://fonts.gstatic.com/s/gelasio/v14/cIfsMaFfvUQxTTqS9Cu7b2nySBfeR6rA1Cho8zTs8xbb.ttf", fontWeight: 700, fontStyle: "italic" },
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

/**
 * Mapping de la police choisie sur le canvas (theme.fontFamily) vers une
 * famille PDF. Serif et mono utilisent les polices standard du PDF (aucun
 * téléchargement) ; « modern » utilise Inter, équivalent PDF d'IBM Plex Sans.
 */
const CV_FONT_TO_PDF: Record<CVFontFamily, PdfFontFamily | string> = {
  sans: "Carlito",
  serif: "Times-Roman",
  modern: "Inter",
  mono: "Courier",
  lato: "Lato",
  montserrat: "Montserrat",
  poppins: "Poppins",
  opensans: "Open Sans",
  sourcesans: "Source Sans 3",
  merriweather: "Merriweather",
  playfair: "Playfair Display",
  georgia: "Gelasio",
};

/** Enregistre (si besoin) et renvoie la famille PDF correspondant au thème. */
export function resolvePdfFontFamily(font?: CVFontFamily): string {
  return registerPdfFont(CV_FONT_TO_PDF[font ?? "sans"] ?? ACTIVE_PDF_FONT);
}

/**
 * Résout une *pile CSS* `font-family` (telle qu'écrite inline par l'éditeur
 * canvas, ex. `'Carlito', sans-serif`) vers une famille PDF enregistrée.
 * Permet à un changement de police sur une sélection de se refléter dans le
 * PDF : le canvas écrit la pile CSS, le PDF la reconnaît et enregistre la bonne
 * police. Renvoie `undefined` si aucune correspondance (→ on garde la police
 * héritée du thème, jamais de crash). */
export function resolvePdfFontFromCss(cssStack?: string): string | undefined {
  if (!cssStack) return undefined;
  const s = cssStack.toLowerCase();
  // Ordre : du plus spécifique au plus générique. Le pack pro est testé en
  // premier (certaines piles contiennent « sans »/« serif » en repli générique).
  if (s.includes("montserrat")) return registerPdfFont("Montserrat");
  if (s.includes("poppins")) return registerPdfFont("Poppins");
  if (s.includes("open sans") || s.includes("opensans")) return registerPdfFont("Open Sans");
  if (s.includes("source sans") || s.includes("sourcesans")) return registerPdfFont("Source Sans 3");
  if (s.includes("merriweather")) return registerPdfFont("Merriweather");
  if (s.includes("playfair")) return registerPdfFont("Playfair Display");
  if (s.includes("gelasio") || s.includes("georgia")) return registerPdfFont("Gelasio");
  if (s.includes("lato")) return registerPdfFont("Lato");
  if (s.includes("carlito") || s.includes("calibri")) return registerPdfFont("Carlito");
  if (s.includes("times")) return registerPdfFont("Times-Roman");
  if (s.includes("inter")) return registerPdfFont("Inter");
  if (s.includes("roboto")) return registerPdfFont("Roboto");
  if (s.includes("courier") || s.includes("mono")) return registerPdfFont("Courier");
  if (s.includes("serif") && !s.includes("sans")) return registerPdfFont("Times-Roman");
  if (s.includes("sans")) return registerPdfFont("Carlito");
  return undefined;
}
