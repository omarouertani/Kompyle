import { ACTIVE_PDF_FONT } from "@/utils/pdf-fonts";

/**
 * Thème typographique global du PDF — version ultra-allégée du système
 * `metadata.typography` de Reactive Resume.
 *
 * Kompyle n'a qu'UN template : un simple objet de tokens suffit. Toutes les
 * primitives lisent ce thème, donc changer la police/taille ici se propage à
 * tout le document.
 */
export interface PdfTheme {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  mutedColor: string;
  boldWeight: number | "bold";
  smallScale: number;
}

export const defaultPdfTheme: PdfTheme = {
  fontFamily: ACTIVE_PDF_FONT,
  fontSize: 12,
  lineHeight: 1.15,
  color: "#1a1a1a",
  mutedColor: "#555555",
  boldWeight: "bold",
  smallScale: 0.875,
};

// Surcharge du thème sans React context (createContext est interdit dans le
// graphe serveur de Next, où la route render-pdf importe ce module).
// PdfThemeProvider pose la valeur dans une variable de module au moment où le
// reconciler react-pdf le rend ; tous ses descendants (rendus de façon
// SYNCHRONE, pas de Suspense dans l'arbre) la lisent via usePdfTheme.
// Les awaits de react-pdf (polices) n'arrivent qu'après la construction de
// l'arbre, donc deux requêtes concurrentes ne peuvent pas s'entrelacer ici.
let currentPdfTheme: PdfTheme = defaultPdfTheme;

export const PdfThemeProvider = ({ children, value }: { children: React.ReactNode; value?: PdfTheme }) => {
  currentPdfTheme = value ?? defaultPdfTheme;
  return children;
};

export const usePdfTheme = (): PdfTheme => currentPdfTheme;
