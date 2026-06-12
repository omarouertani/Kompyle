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

// No React context needed — the theme is a single global constant.
// PdfThemeProvider is kept as a no-op for backwards compatibility.
export const PdfThemeProvider = ({ children }: { children: React.ReactNode; value?: PdfTheme }) => children;
export const usePdfTheme = (): PdfTheme => defaultPdfTheme;
