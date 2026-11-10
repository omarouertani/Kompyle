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
  /** Source .ttf résolue par `fontSrc()` (chemin disque côté serveur, URL /fonts/… côté navigateur). */
  src: string;
  fontWeight?: number | "normal" | "bold";
  fontStyle?: "normal" | "italic";
}

export interface PdfFontDefinition {
  family: string;
  fonts: PdfFontVariant[];
}

/**
 * Source d'un .ttf hébergé dans `public/fonts/<rel>`.
 *  • Serveur (route /api/render-pdf) : react-pdf lit un chemin disque. En
 *    `output: "standalone"`, `public/` est copié dans l'image (cf. Dockerfile)
 *    et `outputFileTracingIncludes` (next.config.ts) l'embarque dans la route.
 *  • Navigateur (aperçu de la lettre) : URL servie par Next.
 */
export function fontSrc(rel: string): string {
  if (typeof window === "undefined") {
    return `${process.cwd()}/public/fonts/${rel}`;
  }
  return `/fonts/${rel}`;
}

/**
 * Registre des polices disponibles.
 *
 *  • Toutes les polices sont des .ttf statiques hébergés dans `public/fonts`
 *    (licence OFL, fichier OFL.txt dans chaque dossier) : aucun appel réseau
 *    vers Google Fonts au rendu, le PDF fonctionne hors-ligne.
 *  • Carlito  → clone MÉTRIQUE-compatible de Calibri (substitut utilisé par RR) :
 *    rendu quasi identique à Calibri (police Microsoft non redistribuable,
 *    donc absente du repo) ; les CV en « Calibri » sont rendus en Carlito.
 *
 * On n'enregistre que 400 (regular) et 700 (bold) — les seuls poids utilisés par
 * le template. PDF plus léger, rendu plus rapide (philosophie RR).
 */
export const PDF_FONTS = {
  Inter: {
    family: "Inter",
    fonts: [
      {
        src: fontSrc("inter/Inter-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: fontSrc("inter/Inter-Bold.ttf"),
        fontWeight: 700,
      },
      // Italic variants — required so the user toggling italic on a selection
      // doesn't crash the render (react-pdf throws if a used variant is unregistered).
      // Inter ships a single variable italic file; we point both weights at it.
      {
        src: fontSrc("inter/Inter-Italic.ttf"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: fontSrc("inter/Inter-Italic.ttf"),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  },
  Roboto: {
    family: "Roboto",
    fonts: [
      {
        src: fontSrc("roboto/Roboto-Regular.ttf"),
        fontWeight: 400,
      },
      {
        src: fontSrc("roboto/Roboto-Bold.ttf"),
        fontWeight: 700,
      },
      {
        src: fontSrc("roboto/Roboto-Italic.ttf"),
        fontWeight: 400,
        fontStyle: "italic",
      },
      {
        src: fontSrc("roboto/Roboto-BoldItalic.ttf"),
        fontWeight: 700,
        fontStyle: "italic",
      },
    ],
  },
  Carlito: {
    family: "Carlito",
    fonts: [
      { src: fontSrc("carlito/Carlito-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("carlito/Carlito-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("carlito/Carlito-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("carlito/Carlito-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  // ── Pack pro (synchronisé avec next/font côté canvas, cf. layout.tsx) ──────
  // .ttf statiques (mêmes métriques que la webfont canvas).
  Lato: {
    family: "Lato",
    fonts: [
      { src: fontSrc("lato/Lato-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("lato/Lato-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("lato/Lato-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("lato/Lato-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Montserrat: {
    family: "Montserrat",
    fonts: [
      { src: fontSrc("montserrat/Montserrat-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("montserrat/Montserrat-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("montserrat/Montserrat-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("montserrat/Montserrat-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Poppins: {
    family: "Poppins",
    fonts: [
      { src: fontSrc("poppins/Poppins-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("poppins/Poppins-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("poppins/Poppins-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("poppins/Poppins-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  "Open Sans": {
    family: "Open Sans",
    fonts: [
      { src: fontSrc("opensans/OpenSans-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("opensans/OpenSans-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("opensans/OpenSans-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("opensans/OpenSans-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  "Source Sans 3": {
    family: "Source Sans 3",
    fonts: [
      { src: fontSrc("sourcesans3/SourceSans3-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("sourcesans3/SourceSans3-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("sourcesans3/SourceSans3-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("sourcesans3/SourceSans3-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Merriweather: {
    family: "Merriweather",
    fonts: [
      { src: fontSrc("merriweather/Merriweather-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("merriweather/Merriweather-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("merriweather/Merriweather-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("merriweather/Merriweather-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  "Playfair Display": {
    family: "Playfair Display",
    fonts: [
      { src: fontSrc("playfairdisplay/PlayfairDisplay-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("playfairdisplay/PlayfairDisplay-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("playfairdisplay/PlayfairDisplay-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("playfairdisplay/PlayfairDisplay-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
    ],
  },
  Gelasio: {
    family: "Gelasio",
    fonts: [
      { src: fontSrc("gelasio/Gelasio-Regular.ttf"), fontWeight: 400 },
      { src: fontSrc("gelasio/Gelasio-Bold.ttf"), fontWeight: 700 },
      { src: fontSrc("gelasio/Gelasio-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
      { src: fontSrc("gelasio/Gelasio-BoldItalic.ttf"), fontWeight: 700, fontStyle: "italic" },
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
