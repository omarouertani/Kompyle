/**
 * Primitives PDF de Kompyle — point d'entrée unique.
 *
 * Surcouches intelligentes de @react-pdf/renderer (typographie globale,
 * anti-coupure, anti-débordement), adaptées de Reactive Resume.
 *
 * Usage dans un template :
 *   import { Page, View, Text, Heading, Bold, Small, Link, Document } from "@/components/pdf-primitives";
 */

// Primitives à typographie globale + safeTextStyle
export { Page, View, Div, KeepTogether, Text, Heading, Bold, Small, Link } from "./primitives";

// Thème global
export { PdfThemeProvider, usePdfTheme, defaultPdfTheme, type PdfTheme } from "./theme";

// Helpers de composition (réutilisables dans les StyleSheet des templates)
export { composeStyles, composeLinkStyles, safeTextStyle, headingSafeLineHeight, type StyleInput } from "./styles";

// Primitives natives sans surcouche, ré-exportées pour un import unique
export { Document, Image, StyleSheet, Font } from "@react-pdf/renderer";
