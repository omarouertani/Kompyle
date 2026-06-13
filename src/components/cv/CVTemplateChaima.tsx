import React from "react";
import {
  Document,
  StyleSheet,
  Page,
  View,
  Text,
  Link,
  KeepTogether,
} from "@/components/pdf-primitives";
import { Svg, Circle, Path, Image } from "@react-pdf/renderer";
import { registerPdfFont, ACTIVE_PDF_FONT } from "@/utils/pdf-fonts";
import type { CVData, CVTheme } from "@/types/cv";
import { defaultLayout, getDefaultPositions, getDefaultPhotoPosition, getPageBlockIds, dedupePages } from "@/lib/cv-layout";
import { wrapText, formatUrl, displayUrl, DiffText } from "@/utils/pdf-text-utils";

registerPdfFont(ACTIVE_PDF_FONT);

// ─── Dynamic Styles Generator ────────────────────────────────────────────────
const getStyles = (theme?: CVTheme, sidebarWidth = 165) => {
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

type SectionRenderer = (
  data: CVData,
  isSidebar: boolean,
  styles: any,
  originalData?: CVData,
  part?: "title" | "content" | "item",
  itemIndex?: number
) => React.ReactNode;

/** Titre d'une section dans le PDF : renommage utilisateur sinon libellé par défaut. */
const sectionTitle = (data: CVData, id: string, fallback: string): string =>
  data.layout?.sectionTitles?.[id] ?? fallback;

const renderContact: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
  const { personalInfo } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";

  return (
    <>
      {showTitle && <Text style={h2Style}>{sectionTitle(data, "contact", "Contact")}</Text>}

      {showContent && (
        <>
          {personalInfo.birthDate && (
            <KeepTogether style={styles.contactItem}>
              <Text style={styles.contactLabel}>Naissance</Text>
              <Text style={styles.contactValue}>{personalInfo.birthDate}</Text>
            </KeepTogether>
          )}

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email</Text>
            <Link src={`mailto:${personalInfo.email}`} style={styles.contactLink}>
              {wrapText(personalInfo.email)}
            </Link>
          </KeepTogether>

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Téléphone</Text>
            <Text style={styles.contactValue}>{personalInfo.phone}</Text>
          </KeepTogether>

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Adresse</Text>
            <Text style={styles.contactValue}>{personalInfo.location}</Text>
          </KeepTogether>

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>LinkedIn</Text>
            <Link src={formatUrl(personalInfo.linkedin)} style={styles.contactLink}>
              {wrapText(displayUrl(personalInfo.linkedin, true))}
            </Link>
          </KeepTogether>

          {personalInfo.portfolio && (
            <KeepTogether style={styles.contactItem}>
              <Text style={styles.contactLabel}>Portfolio</Text>
              <Link src={formatUrl(personalInfo.portfolio)} style={styles.contactLink}>
                {wrapText(displayUrl(personalInfo.portfolio))}
              </Link>
            </KeepTogether>
          )}
        </>
      )}
    </>
  );
};

const renderSkills: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
  const { skills } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  if (part === "title") {
    return <Text style={h2Style}>{sectionTitle(data, "skills", "Compétences")}</Text>;
  }
  if (part === "item") {
    const i = itemIndex ?? 0;
    const group = skills[i];
    if (!group) return null;
    const itemsArray = group.items.split(",").map((item) => item.trim()).filter(Boolean);
    return (
      <KeepTogether key={group.id ?? i} style={styles.skillGroup}>
        <Text style={styles.skillCat}>{group.category}</Text>
        <View style={styles.skillsContainer}>
          {itemsArray.map((item, idx) => (
            <View key={idx} style={styles.skillTag}>
              <Text style={styles.skillTagText}>{item}</Text>
            </View>
          ))}
        </View>
      </KeepTogether>
    );
  }
  return (
    <>
      <Text style={h2Style}>{sectionTitle(data, "skills", "Compétences")}</Text>
      {skills.map((group, i) => {
        const itemsArray = group.items.split(",").map((item) => item.trim()).filter(Boolean);
        return (
          <KeepTogether key={group.id ?? i} style={styles.skillGroup}>
            <Text style={styles.skillCat}>{group.category}</Text>
            <View style={styles.skillsContainer}>
              {itemsArray.map((item, idx) => (
                <View key={idx} style={styles.skillTag}>
                  <Text style={styles.skillTagText}>{item}</Text>
                </View>
              ))}
            </View>
          </KeepTogether>
        );
      })}
    </>
  );
};

const renderLanguages: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
  const { spokenLanguages } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";

  return (
    <>
      {showTitle && <Text style={h2Style}>{sectionTitle(data, "languages", "Langues")}</Text>}
      {showContent && (
        <View>
          {spokenLanguages.map((lang, i) => (
            <View key={i} style={styles.langItem}>
              <View style={styles.langDot} />
              <Text style={styles.langText}>{lang}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
};

const renderCertifications: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
  const { personalInfo } = data;
  if (!personalInfo.certifications) return null;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";

  return (
    <>
      {showTitle && <Text style={h2Style}>{sectionTitle(data, "certifications", "Certifications")}</Text>}
      {showContent && (
        <View>
          {personalInfo.certifications.split(",").map((cert, i) => (
            <View key={i} style={styles.langItem}>
              <View style={styles.langDot} />
              <Text style={styles.langText}>{cert.trim()}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
};

const renderInterests: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
  const { personalInfo } = data;
  if (!personalInfo.interests) return null;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  const items = personalInfo.interests.split(/[·,]/).map(x => x.trim()).filter(Boolean);
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";

  return (
    <>
      {showTitle && <Text style={h2Style}>{sectionTitle(data, "interests", "Intérêts")}</Text>}
      {showContent && (
        <View style={styles.skillsContainer}>
          {items.map((item, i) => (
            <View key={i} style={styles.skillTag}>
              <Text style={styles.skillTagText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
};

const renderSummary: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
  const { personalInfo } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";

  return (
    <>
      {showTitle && <Text style={h2Style}>{sectionTitle(data, "summary", "Profil")}</Text>}
      {showContent && (
        <DiffText
          oldText={originalData?.personalInfo.summary}
          newText={personalInfo.summary}
          style={styles.summary}
        />
      )}
    </>
  );
};

const renderExperience: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
  const { experiences } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  if (part === "title") {
    return <Text style={h2Style}>{sectionTitle(data, "experience", "Expériences Professionnelles")}</Text>;
  }
  if (part === "item") {
    const i = itemIndex ?? 0;
    const exp = experiences[i];
    if (!exp) return null;
    return (
      <View
        key={exp.id ?? i}
        break={exp.forcePageBreak}
        style={[
          styles.entry,
          i === experiences.length - 1 ? styles.entryLast : {},
          exp.customMarginBottom !== undefined ? { marginBottom: exp.customMarginBottom } : {},
        ]}
      >
        <KeepTogether style={styles.entryHead}>
          <View style={styles.entryHeadLeft}>
            <Text>
              <Text style={styles.entryTitle}>{exp.title}</Text>
              <Text> — </Text>
              <Text style={styles.entryOrg}>{exp.org}</Text>
            </Text>
          </View>
          <View style={styles.entryDateWrap}>
            <Text style={styles.entryDate}>{exp.date}</Text>
          </View>
        </KeepTogether>

        <View style={styles.bulletList}>
          {exp.bullets.map((bullet, j) => (
            <View
              key={j}
              style={[
                styles.bulletRow,
                j === exp.bullets.length - 1 ? { marginBottom: 0 } : {},
              ]}
            >
              <Text style={styles.bulletMarker}>•</Text>
              <DiffText
                oldText={originalData?.experiences[i]?.bullets[j]}
                newText={bullet}
                style={styles.bulletText}
              />
            </View>
          ))}
        </View>
      </View>
    );
  }
  return (
    <>
      <Text style={h2Style}>{sectionTitle(data, "experience", "Expériences Professionnelles")}</Text>
      {experiences.map((exp, i) => (
        <View
          key={exp.id ?? i}
          break={exp.forcePageBreak}
          style={[
            styles.entry,
            i === experiences.length - 1 ? styles.entryLast : {},
            exp.customMarginBottom !== undefined ? { marginBottom: exp.customMarginBottom } : {},
          ]}
        >
          <KeepTogether style={styles.entryHead}>
            <View style={styles.entryHeadLeft}>
              <Text>
                <Text style={styles.entryTitle}>{exp.title}</Text>
                <Text> — </Text>
                <Text style={styles.entryOrg}>{exp.org}</Text>
              </Text>
            </View>
            <View style={styles.entryDateWrap}>
              <Text style={styles.entryDate}>{exp.date}</Text>
            </View>
          </KeepTogether>

          <View style={styles.bulletList}>
            {exp.bullets.map((bullet, j) => (
              <View
                key={j}
                style={[
                  styles.bulletRow,
                  j === exp.bullets.length - 1 ? { marginBottom: 0 } : {},
                ]}
              >
                <Text style={styles.bulletMarker}>•</Text>
                <DiffText
                  oldText={originalData?.experiences[i]?.bullets[j]}
                  newText={bullet}
                  style={styles.bulletText}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </>
  );
};

const renderEducation: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
  const { education } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  if (part === "title") {
    return <Text style={h2Style}>{sectionTitle(data, "education", "Formation")}</Text>;
  }
  if (part === "item") {
    const i = itemIndex ?? 0;
    const edu = education[i];
    if (!edu) return null;
    return (
      <KeepTogether
        key={edu.id ?? i}
        break={edu.forcePageBreak}
        style={[
          styles.eduBlock,
          edu.customMarginBottom !== undefined ? { marginBottom: edu.customMarginBottom } : {},
        ]}
      >
        <Text style={styles.eduDegree}>{edu.degree}</Text>
        <Text style={styles.eduInstitution}>{edu.institution}</Text>{edu.date ? <Text style={styles.eduInstitution}>{edu.date}</Text> : null}
      </KeepTogether>
    );
  }
  return (
    <>
      <Text style={h2Style}>{sectionTitle(data, "education", "Formation")}</Text>
      {education.map((edu, i) => (
        <KeepTogether
          key={edu.id ?? i}
          break={edu.forcePageBreak}
          style={[
            styles.eduBlock,
            edu.customMarginBottom !== undefined ? { marginBottom: edu.customMarginBottom } : {},
          ]}
        >
          <Text style={styles.eduDegree}>{edu.degree}</Text>
          <Text style={styles.eduInstitution}>{edu.institution}</Text>{edu.date ? <Text style={styles.eduInstitution}>{edu.date}</Text> : null}
        </KeepTogether>
      ))}
    </>
  );
};

const renderProjects: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
  const { projects } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  if (!projects || projects.length === 0) return null;
  if (part === "title") {
    return <Text style={h2Style}>{sectionTitle(data, "projects", "Projets")}</Text>;
  }
  if (part === "item") {
    const i = itemIndex ?? 0;
    const proj = projects[i];
    if (!proj) return null;
    return (
      <View
        key={proj.id ?? i}
        break={proj.forcePageBreak}
        style={[
          styles.entry,
          i === projects.length - 1 ? styles.entryLast : {},
          proj.customMarginBottom !== undefined ? { marginBottom: proj.customMarginBottom } : {},
        ]}
      >
        <Text style={styles.projTitle}>{proj.title}</Text>
        <DiffText
          oldText={originalData?.projects[i]?.description}
          newText={proj.description}
          style={styles.projDesc}
        />
        {proj.stack && (
          <Text style={styles.projStack}>
            <Text style={styles.projStackBold}>Stack: </Text>
            <Text>{proj.stack}</Text>
          </Text>
        )}
      </View>
    );
  }
  return (
    <>
      <Text style={h2Style}>{sectionTitle(data, "projects", "Projets")}</Text>
      {projects.map((proj, i) => (
        <View
          key={proj.id ?? i}
          break={proj.forcePageBreak}
          style={[
            styles.entry,
            i === projects.length - 1 ? styles.entryLast : {},
            proj.customMarginBottom !== undefined ? { marginBottom: proj.customMarginBottom } : {},
          ]}
        >
          <Text style={styles.projTitle}>{proj.title}</Text>
          <DiffText
            oldText={originalData?.projects[i]?.description}
            newText={proj.description}
            style={styles.projDesc}
          />
          {proj.stack && (
            <Text style={styles.projStack}>
              <Text style={styles.projStackBold}>Stack: </Text>
              <Text>{proj.stack}</Text>
            </Text>
          )}
        </View>
      ))}
    </>
  );
};

const SECTION_RENDERERS: Record<string, SectionRenderer> = {
  contact: renderContact,
  skills: renderSkills,
  languages: renderLanguages,
  education: renderEducation,
  summary: renderSummary,
  experience: renderExperience,
  projects: renderProjects,
  certifications: renderCertifications,
  interests: renderInterests,
};

const renderColumn = (
  ids: string[],
  data: CVData,
  isSidebar: boolean,
  styles: any,
  originalData?: CVData
) => {
  const known = ids.filter((id) => SECTION_RENDERERS[id]);
  return known.map((id, i) => {
    // Gracefully handle empty render
    const rendered = SECTION_RENDERERS[id](data, isSidebar, styles, originalData);
    if (!rendered) return null;

    return (
      <View key={id} style={i === known.length - 1 ? styles.sectionLast : styles.section}>
        {rendered}
      </View>
    );
  });
};

interface CVTemplateChaimaProps {
  data: CVData;
  originalData?: CVData;
}

const CVTemplateChaima: React.FC<CVTemplateChaimaProps> = ({ data, originalData }) => {
  const { personalInfo } = data;
  const layout = data.layout ?? defaultLayout();
  const sidebarWidth = layout.sidebarWidth ?? 175;
  const styles = getStyles(layout.theme, sidebarWidth);

  return (
    <Document
      title={`${personalInfo.name} — ${personalInfo.role} (CV)`}
      author={personalInfo.name}
      subject={personalInfo.role}
    >
      {dedupePages(layout.pages).map((page, pageIndex) => {
        const hasSidebar = page.sidebar.some((id) => SECTION_RENDERERS[id]);

        const useAbsolute = layout.useAbsolutePositioning || false;

        if (useAbsolute) {
          const absolutePositions = layout.absolutePositions || getDefaultPositions("chaima", data);
          // Honore la pagination auto (position.page) si présente, sinon le
          // modèle historique section→page de `layout.pages`.
          const { sidebar: sidebarBlocks, main: mainBlocks } = getPageBlockIds(layout, data, pageIndex);
          const hasSidebarAbs = sidebarBlocks.length > 0;

          // STEP: sidebar background in absolute mode
          const sidebarBgStyle = {
            position: "absolute" as const,
            left: 0,
            top: 0,
            width: sidebarWidth,
            height: "100%",
            backgroundColor: styles.sidebar.backgroundColor,
            borderRightWidth: 1,
            borderRightColor: "#e4e4e7",
          };

          // STEP: header + photo in absolute mode
          const renderAbsoluteHeaderAndPhoto = (pi: number) => {
            if (pi !== 0) return null;
            const photoPos = absolutePositions.photo || getDefaultPhotoPosition("chaima", sidebarWidth);
            const namePos = absolutePositions.name || { x: 200, y: 20, w: 370 };
            const rolePos = absolutePositions.role || { x: 200, y: 48, w: 370 };
            const techPos = absolutePositions.techLine || { x: 200, y: 66, w: 370 };
            return (
              <>
                <View style={{ position: "absolute", left: photoPos.x, top: photoPos.y, width: photoPos.w ?? 65, alignItems: "center" }}>
                  <View style={[styles.avatarCircle, { width: photoPos.w ?? 65, height: photoPos.w ?? 65, borderRadius: (photoPos.w ?? 65) / 2 }]}>
                    {personalInfo.photo ? (
                      <Image src={personalInfo.photo} style={styles.avatarImage} />
                    ) : (
                      <Svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
                        <Circle cx="50" cy="50" r="48" fill="#cbd5e1" />
                        <Circle cx="50" cy="40" r="18" fill="#475569" />
                        <Path
                          d="M 22,82 C 22,65 34,58 50,58 C 66,58 78,65 78,82 C 78,85 75,85 50,85 C 25,85 22,85 22,82 Z"
                          fill="#475569"
                        />
                      </Svg>
                    )}
                  </View>
                </View>
                <View style={{ position: "absolute", left: namePos.x, top: namePos.y, width: namePos.w }}>
                  <Text style={styles.h1}>{personalInfo.name}</Text>
                </View>
                <View style={{ position: "absolute", left: rolePos.x, top: rolePos.y, width: rolePos.w }}>
                  <Text style={styles.role}>{personalInfo.role}</Text>
                </View>
                {personalInfo.techLine && (
                  <View style={{ position: "absolute", left: techPos.x, top: techPos.y, width: techPos.w }}>
                    <DiffText
                      oldText={originalData?.personalInfo.techLine}
                      newText={personalInfo.techLine}
                      style={styles.techLine}
                    />
                  </View>
                )}
              </>
            );
          };

          const renderAbsoluteBlock = (blockId: string, isSidebar: boolean) => {
            const defaultPositions = getDefaultPositions("chaima", data);
            const pos = absolutePositions[blockId] || defaultPositions[blockId];
            if (!pos) return null;
            // Position hors page A4 (842pt) : on ignore le bloc plutôt que de
            // casser le rendu PDF (page blanche / boucle de pagination).
            if (pos.y >= 842 || pos.x >= 595) return null;

            let rendered: React.ReactNode = null;
            // STEP: custom sections support
            if (blockId.startsWith("title_custom_") || blockId.startsWith("content_custom_")) {
              const isTitle = blockId.startsWith("title_");
              const sectionId = blockId.substring(isTitle ? 6 : 8);
              const cs = data.customSections?.find((c) => `custom_${c.id}` === sectionId);
              if (cs) {
                rendered = isTitle
                  ? <Text style={isSidebar ? styles.h2Sidebar : styles.h2Main}>{cs.title}</Text>
                  : <Text style={styles.summary}>{cs.content}</Text>;
              }
            } else if (blockId.startsWith("title_")) {
              const sectionId = blockId.substring(6);
              rendered = SECTION_RENDERERS[sectionId]
                ? SECTION_RENDERERS[sectionId](data, isSidebar, styles, originalData, "title")
                : null;
            } else if (blockId === "content_contact") {
              rendered = renderContact(data, isSidebar, styles, originalData, "content");
            } else if (blockId === "content_languages") {
              rendered = renderLanguages(data, isSidebar, styles, originalData, "content");
            } else if (blockId === "content_summary") {
              rendered = renderSummary(data, isSidebar, styles, originalData, "content");
            } else if (blockId === "content_certifications") {
              rendered = renderCertifications(data, isSidebar, styles, originalData, "content");
            } else if (blockId === "content_interests") {
              rendered = renderInterests(data, isSidebar, styles, originalData, "content");
            } else if (blockId.startsWith("skill_")) {
              const idx = parseInt(blockId.split("_")[1]);
              rendered = renderSkills(data, isSidebar, styles, originalData, "item", idx);
            } else if (blockId.startsWith("education_")) {
              const idx = parseInt(blockId.split("_")[1]);
              rendered = renderEducation(data, isSidebar, styles, originalData, "item", idx);
            } else if (blockId.startsWith("experience_")) {
              const idx = parseInt(blockId.split("_")[1]);
              rendered = renderExperience(data, isSidebar, styles, originalData, "item", idx);
            } else if (blockId.startsWith("project_")) {
              const idx = parseInt(blockId.split("_")[1]);
              rendered = renderProjects(data, isSidebar, styles, originalData, "item", idx);
            }

            if (!rendered) return null;

            return (
              <View key={blockId} style={{ position: "absolute", left: pos.x, top: pos.y, width: pos.w }}>
                {rendered}
              </View>
            );
          };

          return (
            <Page key={pageIndex} size="A4" style={[styles.page, { padding: 0 }]}>
              {hasSidebarAbs && <View style={sidebarBgStyle} />}
              {renderAbsoluteHeaderAndPhoto(pageIndex)}
              {sidebarBlocks.map((id) => renderAbsoluteBlock(id, true))}
              {mainBlocks.map((id) => renderAbsoluteBlock(id, false))}
            </Page>
          );
        }

        return (
          <Page key={pageIndex} size="A4" style={styles.page}>
            <View style={styles.body}>
              {hasSidebar && (
                <View style={styles.sidebar}>
                  {pageIndex === 0 && (
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatarCircle}>
                        {personalInfo.photo ? (
                          <Image src={personalInfo.photo} style={styles.avatarImage} />
                        ) : (
                          <Svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%" }}>
                            <Circle cx="50" cy="50" r="48" fill="#cbd5e1" />
                            <Circle cx="50" cy="40" r="18" fill="#475569" />
                            <Path
                              d="M 22,82 C 22,65 34,58 50,58 C 66,58 78,65 78,82 C 78,85 75,85 50,85 C 25,85 22,85 22,82 Z"
                              fill="#475569"
                            />
                          </Svg>
                        )}
                      </View>
                    </View>
                  )}

                  {renderColumn(page.sidebar, data, true, styles, originalData)}
                </View>
              )}

              <View style={styles.main}>
                {pageIndex === 0 && (
                  <View style={styles.header}>
                    <Text style={styles.h1}>{personalInfo.name}</Text>
                    <Text style={styles.role}>{personalInfo.role}</Text>
                    {personalInfo.techLine && (
                      <DiffText
                        oldText={originalData?.personalInfo.techLine}
                        newText={personalInfo.techLine}
                        style={styles.techLine}
                      />
                    )}
                  </View>
                )}

                {renderColumn(page.main, data, false, styles, originalData)}
              </View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default CVTemplateChaima;
