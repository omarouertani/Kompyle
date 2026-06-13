import { StyleSheet } from "@/components/pdf-primitives";
import type { CVTheme } from "@/types/cv";

/** Génère la feuille de styles du template moderne (sidebar avec avatar) à
 *  partir du thème utilisateur et de la largeur de sidebar. */
export const getStyles = (theme?: CVTheme, sidebarWidth = 165) => {
  const primaryColor = theme?.primaryColor || "#fbbf24";
  const textColor = theme?.textColor || "#27272a";
  const sidebarBg = theme?.sidebarBg || "#f4f4f5";

  // Dynamic typography & spacing
  const baseFontSize = theme?.fontSize !== undefined ? theme.fontSize : 9.5;
  const headingFontSize = theme?.headingSize !== undefined ? theme.headingSize : 11;
  const sectionMarginBottom = theme?.sectionMargin !== undefined ? theme.sectionMargin : 12;
  const lh = theme?.lineHeight !== undefined ? theme.lineHeight : 1.25;

  return StyleSheet.create({
    page: {
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
      flexDirection: "row",
      backgroundColor: theme?.pageBg || "#ffffff",
    },
    body: {
      flexDirection: "row",
      width: "100%",
      flexGrow: 1,
    },
    sidebar: {
      width: sidebarWidth,
      backgroundColor: sidebarBg,
      paddingTop: 20,
      paddingBottom: 20,
      paddingLeft: 12,
      paddingRight: 12,
      borderRightWidth: 1,
      borderRightColor: "#e4e4e7",
    },
    main: {
      flex: 1,
      backgroundColor: "#ffffff",
      paddingTop: 20,
      paddingBottom: 20,
      paddingLeft: 20,
      paddingRight: 20,
    },

    /* ---------- Avatar ---------- */
    avatarContainer: {
      alignItems: "center",
      marginBottom: 16,
    },
    avatarCircle: {
      width: 65,
      height: 65,
      borderRadius: 32.5,
      borderWidth: 1.5,
      borderColor: primaryColor,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#e4e4e7",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
    },

    /* ---------- Header ---------- */
    header: {
      marginBottom: 12,
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      paddingBottom: 6,
    },
    h1: {
      fontSize: 22,
      fontWeight: "bold",
      letterSpacing: -0.5,
      color: "#18181b",
      lineHeight: 1.25,
      textTransform: "uppercase",
    },
    role: {
      fontSize: 11,
      fontWeight: "bold",
      color: primaryColor,
      marginTop: 2,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      lineHeight: 1.2,
    },
    techLine: {
      fontSize: 8.5,
      color: "#71717a",
      marginTop: 3,
    },

    /* ---------- Section Headers ---------- */
    h2Sidebar: {
      fontSize: headingFontSize - 1.5,
      fontWeight: "bold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: "#18181b",
      marginBottom: 6,
      paddingBottom: 2,
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      lineHeight: 1.15,
    },
    h2Main: {
      fontSize: headingFontSize,
      fontWeight: "bold",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      color: "#18181b",
      marginBottom: 6,
      paddingBottom: 2,
      borderBottomWidth: 1.5,
      borderBottomColor: primaryColor,
      lineHeight: 1.15,
    },

    /* ---------- Sections ---------- */
    section: {
      marginBottom: sectionMarginBottom,
    },
    sectionLast: {
      marginBottom: 0,
    },

    /* ---------- Contact ---------- */
    contactItem: {
      marginBottom: 5,
    },
    contactLabel: {
      fontSize: 7,
      letterSpacing: 0.5,
      textTransform: "uppercase",
      color: "#71717a",
      marginBottom: 1,
    },
    contactValue: {
      fontSize: baseFontSize - 0.5,
      color: textColor,
      lineHeight: lh,
    },
    contactLink: {
      fontSize: baseFontSize - 0.5,
      color: textColor,
      lineHeight: lh,
    },

    /* ---------- Skills (Tags) ---------- */
    skillGroup: {
      marginBottom: 6,
    },
    skillCat: {
      fontWeight: "bold",
      fontSize: baseFontSize - 0.5,
      color: "#27272a",
      marginBottom: 2.5,
    },
    skillsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 3,
    },
    skillTag: {
      backgroundColor: "#ffffff",
      borderWidth: 0.75,
      borderColor: "#e4e4e7",
      borderLeftWidth: 2,
      borderLeftColor: primaryColor,
      paddingVertical: 2,
      paddingHorizontal: 4,
      borderRadius: 2,
      marginBottom: 2.5,
      marginRight: 2.5,
    },
    skillTagText: {
      fontSize: baseFontSize - 1.5,
      color: "#3f3f46",
    },
    skillListText: {
      fontSize: baseFontSize - 1,
      color: "#3f3f46",
      lineHeight: lh,
    },
    skillBarRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 2.5,
    },
    skillBarLabel: {
      flex: 1,
      fontSize: baseFontSize - 1,
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

    /* ---------- Languages & Certifications ---------- */
    langItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 3.5,
    },
    langDot: {
      width: 3.5,
      height: 3.5,
      borderRadius: 1.75,
      backgroundColor: primaryColor,
      marginRight: 5,
    },
    langText: {
      fontSize: baseFontSize - 0.5,
      color: textColor,
    },

    /* ---------- Summary ---------- */
    summary: {
      textAlign: "justify",
      fontSize: baseFontSize + 1,
      lineHeight: lh,
      color: "#3f3f46",
    },

    /* ---------- Experiences ---------- */
    entry: {
      marginBottom: 8,
    },
    entryLast: {
      marginBottom: 0,
    },
    entryHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 3,
    },
    entryHeadLeft: {
      flex: 1,
      paddingRight: 10,
      lineHeight: 1.15,
    },
    entryTitle: {
      fontWeight: "bold",
      fontSize: baseFontSize + 0.5,
      color: "#18181b",
    },
    entryOrg: {
      fontWeight: "bold",
      color: "#71717a",
      fontSize: baseFontSize + 0.5,
    },
    entryDateWrap: {
      flexShrink: 0,
      paddingTop: 1,
    },
    entryDate: {
      fontSize: baseFontSize - 1,
      color: "#71717a",
    },

    /* ---------- Bullets ---------- */
    bulletList: {
      marginTop: 1,
    },
    bulletRow: {
      flexDirection: "row",
      marginBottom: 2,
      alignItems: "flex-start",
    },
    bulletMarker: {
      width: 8,
      fontSize: 10,
      color: primaryColor,
      lineHeight: 1.2,
    },
    bulletText: {
      flex: 1,
      fontSize: baseFontSize,
      lineHeight: lh,
      textAlign: "justify",
      color: "#3f3f46",
    },

    /* ---------- Education ---------- */
    eduBlock: {
      marginBottom: 6,
    },
    eduDegree: {
      fontSize: baseFontSize + 0.5,
      fontWeight: "bold",
      color: "#18181b",
      lineHeight: lh,
    },
    eduInstitution: {
      fontSize: baseFontSize - 0.5,
      color: "#71717a",
      marginTop: 1,
    },

    /* ---------- Projects ---------- */
    projTitle: {
      fontWeight: "bold",
      fontSize: baseFontSize + 0.5,
      color: "#18181b",
      marginBottom: 1,
    },
    projDesc: {
      fontSize: baseFontSize,
      color: "#3f3f46",
      marginBottom: 1,
      lineHeight: lh,
      textAlign: "justify",
    },
    projStack: {
      color: "#71717a",
      fontSize: baseFontSize - 1,
    },
    projStackBold: {
      fontWeight: "bold",
      color: "#27272a",
    },
  });
};
