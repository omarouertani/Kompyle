"use client";

import { createContext, useContext } from "react";
import { ACTIVE_PDF_FONT } from "@/utils/pdf-fonts";

/**
 * Thème typographique global du PDF — version ultra-allégée du système
 * `metadata.typography` de Reactive Resume.
 *
 * RR injecte sa typographie via un lourd RenderProvider couplé à leur schéma.
 * Kompyle n'a qu'UN template : un simple contexte de tokens suffit. Toutes les
 * primitives lisent ce thème, donc changer la police/taille ici se propage à
 * tout le document (utile pour l'Étape 2 : polices pro interchangeables).
 */
export interface PdfTheme {
  /** Famille de police (doit être enregistrée via Font.register). */
  fontFamily: string;
  /** Taille de corps de base (pt). */
  fontSize: number;
  /** Interligne du corps de texte. */
  lineHeight: number;
  /** Couleur de texte principale. */
  color: string;
  /** Couleur de texte secondaire/atténuée. */
  mutedColor: string;
  /** Graisse utilisée par <Bold> et <Heading>. */
  boldWeight: number | "bold";
  /** <Small> = fontSize * smallScale. */
  smallScale: number;
}

/**
 * `fontFamily` suit la police active (utils/pdf-fonts.ts) : changer ACTIVE_PDF_FONT
 * met à jour toute la typographie. Le reste = design Calibri actuel de Kompyle.
 * → Fonctionne même sans <PdfThemeProvider> (filet de sécurité au cas où le
 *   contexte ne traverserait pas le reconciler react-pdf).
 */
export const defaultPdfTheme: PdfTheme = {
  fontFamily: ACTIVE_PDF_FONT,
  fontSize: 12,
  lineHeight: 1.15,
  color: "#1a1a1a",
  mutedColor: "#555555",
  boldWeight: "bold",
  smallScale: 0.875,
};

const PdfThemeContext = createContext<PdfTheme>(defaultPdfTheme);

export const PdfThemeProvider = PdfThemeContext.Provider;

/** Lit le thème courant (retombe sur defaultPdfTheme hors Provider). */
export const usePdfTheme = (): PdfTheme => useContext(PdfThemeContext);
