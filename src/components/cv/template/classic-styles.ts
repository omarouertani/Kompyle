import { StyleSheet } from "@/components/pdf-primitives";
import type { CVTheme } from "@/types/cv";

export type CVTemplateVariant = "classic" | "canadian";

/** Génère la feuille de styles du template classique / canadien à partir du
 *  thème utilisateur et de la largeur de sidebar. */
export const getStyles = (theme?: CVTheme, sidebarWidth = 165, variant: CVTemplateVariant = "classic") => {
  const isCanadian = variant === "canadian";
  // Le CV canadien est sobre : accent anthracite/marine, aucune couleur de
  // fond de barre latérale, en-tête épuré (pas de photo).
  const primaryColor = theme?.primaryColor || (isCanadian ? "#1f2d3d" : "#1a1a1a");
  const textColor = theme?.textColor || "#27272a";
  const sidebarBg = isCanadian ? "transparent" : (theme?.sidebarBg || "transparent");

  const baseFontSize = theme?.fontSize !== undefined ? theme.fontSize : 10;
  const headingFontSize = theme?.headingSize !== undefined ? theme.headingSize : 12;
  const sectionMarginBottom = theme?.sectionMargin !== undefined ? theme.sectionMargin : 5;
  const lh = theme?.lineHeight !== undefined ? theme.lineHeight : 1.15;

  return StyleSheet.create({
    page: {
      paddingTop: 12,
      paddingBottom: 12,
      paddingLeft: 24,
      paddingRight: 24,
      backgroundColor: theme?.pageBg || "#ffffff",
    },

    /* ---------- Header ---------- */
    header: {
      borderBottomWidth: 1,
      borderBottomColor: primaryColor,
      paddingBottom: 4,
      marginBottom: 4,
    },
    h1: {
      fontSize: baseFontSize * 2.4,
      fontWeight: "bold",
      letterSpacing: -0.2,
      marginBottom: 1,
      lineHeight: 1.25,
      color: textColor,
    },
    role: {
      fontSize: baseFontSize + 2,
      fontWeight: "bold",
      marginBottom: 1,
      lineHeight: 1.25,
      color: primaryColor !== "#1a1a1a" ? primaryColor : textColor,
    },
    techLine: {
      fontSize: baseFontSize - 1,
      color: "#555555",
      marginBottom: 1,
    },

    /* ---------- Canadian header contact line ---------- */
    contactHeader: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      marginTop: 2,
    },
    contactHeaderItem: {
      fontSize: baseFontSize - 0.5,
      color: "#444444",
    },
    contactHeaderLink: {
      fontSize: baseFontSize - 0.5,
      color: "#444444",
      textDecoration: "none",
    },
    contactHeaderSep: {
      fontSize: baseFontSize - 0.5,
      color: "#aaaaaa",
      marginHorizontal: 4,
    },

    /* ---------- Two-column layout ---------- */
    body: {
      flexDirection: "row",
      columnGap: 24,
    },
    sidebar: {
      width: sidebarWidth,
      flexShrink: 0,
      flexGrow: 0,
      backgroundColor: sidebarBg,
    },
    main: {
      flex: 1,
    },

    /* ---------- Sections ---------- */
    section: {
      marginBottom: sectionMarginBottom,
    },
    sectionLast: {
      marginBottom: 0,
    },
    h2: {
      fontSize: headingFontSize,
      fontWeight: "bold",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 2,
      paddingBottom: 1,
      borderBottomWidth: 0.75,
      borderBottomColor: primaryColor,
      lineHeight: 1.15,
      color: primaryColor,
    },

    /* ---------- Contact ---------- */
    contactItem: {
      marginBottom: 3,
    },
    contactItemLast: {
      marginBottom: 0,
    },
    contactLabel: {
      fontSize: baseFontSize - 2,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: "#777777",
      marginBottom: 0,
      lineHeight: 1,
    },
    contactValue: {
      fontSize: baseFontSize,
      color: textColor,
      lineHeight: lh,
    },
    contactLink: {
      fontSize: baseFontSize,
      color: textColor,
      lineHeight: lh,
    },

    /* ---------- Sidebar skill groups ---------- */
    skillGroup: {
      marginBottom: 4,
    },
    skillGroupLast: {
      marginBottom: 0,
    },
    skillCat: {
      fontWeight: "bold",
      fontSize: baseFontSize,
      color: textColor,
      marginBottom: 1,
    },
    skillList: {
      fontSize: baseFontSize,
      color: "#555555",
      lineHeight: lh,
    },
    skillTagWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    skillTag: {
      borderWidth: 0.75,
      borderColor: primaryColor,
      borderRadius: 6,
      paddingVertical: 1.5,
      paddingHorizontal: 5,
      marginRight: 3,
      marginBottom: 3,
    },
    skillTagText: {
      fontSize: baseFontSize - 0.5,
      color: "#3f3f46",
    },
    skillBarRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2.5,
    },
    skillBarLabel: {
      flex: 1,
      fontSize: baseFontSize - 0.5,
      color: textColor,
      paddingRight: 6,
      lineHeight: lh,
    },
    skillBarTrack: {
      width: 36,
      height: 2.5,
      borderRadius: 1.25,
      backgroundColor: "#e4e4e7",
    },
    skillBarFill: {
      width: "75%",
      height: "100%",
      borderRadius: 1.25,
      backgroundColor: primaryColor,
    },

    /* ---------- Side block (languages, education) ---------- */
    sideBlock: {
      marginBottom: 4,
    },
    sideBlockText: {
      fontSize: baseFontSize,
      color: textColor,
      marginBottom: 1,
    },
    sideBlockLead: {
      fontSize: baseFontSize,
      fontWeight: "bold",
      color: textColor,
      marginBottom: 1,
      lineHeight: lh,
    },
    sideBlockSub: {
      fontSize: baseFontSize,
      color: "#555555",
      lineHeight: lh,
    },

    /* ---------- Summary ---------- */
    summary: {
      textAlign: "justify",
      fontSize: baseFontSize,
      lineHeight: lh,
      color: textColor,
    },

    /* ---------- Experience entries ---------- */
    entry: {
      marginBottom: 5,
    },
    entryLast: {
      marginBottom: 0,
    },
    entryHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 2,
    },
    entryHeadLeft: {
      flex: 1,
      paddingRight: 10,
      lineHeight: lh,
    },
    entryTitle: {
      fontWeight: "bold",
      fontSize: baseFontSize + 0.5,
      color: textColor,
    },
    entryOrg: {
      fontWeight: "bold",
      color: primaryColor !== "#1a1a1a" ? primaryColor : textColor,
      fontSize: baseFontSize + 0.5,
    },
    entryDateWrap: {
      flexShrink: 0,
      paddingTop: 1,
    },
    entryDate: {
      fontSize: baseFontSize - 1.5,
      color: "#555555",
    },

    /* ---------- Bullet list ---------- */
    bulletList: {
      marginTop: 0,
    },
    bulletRow: {
      flexDirection: "row",
      marginBottom: 1,
      alignItems: "flex-start",
    },
    bulletMarker: {
      width: 10,
      fontSize: baseFontSize,
      color: primaryColor,
      lineHeight: lh,
    },
    bulletText: {
      flex: 1,
      fontSize: baseFontSize,
      lineHeight: lh,
      textAlign: "justify",
      color: textColor,
    },

    /* ---------- Projects ---------- */
    projTitle: {
      fontWeight: "bold",
      fontSize: baseFontSize + 0.5,
      color: textColor,
      marginBottom: 1,
    },
    projDesc: {
      fontSize: baseFontSize,
      color: textColor,
      marginBottom: 1,
      lineHeight: lh,
      textAlign: "justify",
    },
    projStack: {
      color: "#555555",
      fontSize: baseFontSize - 0.5,
    },
    projStackBold: {
      fontWeight: "bold",
      color: textColor,
    },
  });
};
