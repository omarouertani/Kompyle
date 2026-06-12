import React from "react";
import {
  Document,
  StyleSheet,
  Page,
  View,
  Text,
  Link,
  KeepTogether,
  Image,
} from "@/components/pdf-primitives";
import { registerPdfFont, ACTIVE_PDF_FONT } from "@/utils/pdf-fonts";
import type { CVData, CVTheme } from "@/types/cv";
import { defaultLayout, DEFAULT_SIDEBAR_WIDTH, getDefaultPositions, getDefaultPhotoPosition, getPageBlockIds } from "@/lib/cv-layout";
import { wrapText, formatUrl, displayUrl, DiffText } from "@/utils/pdf-text-utils";

registerPdfFont(ACTIVE_PDF_FONT);

// ─── Dynamic Styles Generator ────────────────────────────────────────────────
const getStyles = (theme?: CVTheme, sidebarWidth = 165) => {
  const primaryColor = theme?.primaryColor || "#1a1a1a";
  const textColor = theme?.textColor || "#27272a";
  const sidebarBg = theme?.sidebarBg || "transparent";

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

// ─── Section renderers ───────────────────────────────────────────────────────

type SectionRenderer = (data: CVData, styles: any, originalData?: CVData, part?: "title" | "content" | "item", itemIndex?: number) => React.ReactNode;

const renderContact: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <Text style={styles.h2}>Contact</Text>}

      {showContent && (
        <>
          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email</Text>
            <Link src={`mailto:${personalInfo.email}`} style={styles.contactLink}>
              {wrapText(personalInfo.email)}
            </Link>
          </KeepTogether>

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Phone</Text>
            <Text style={styles.contactValue}>{personalInfo.phone}</Text>
          </KeepTogether>

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Location</Text>
            <Text style={styles.contactValue}>{personalInfo.location}</Text>
          </KeepTogether>

          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>LinkedIn</Text>
            <Link src={formatUrl(personalInfo.linkedin)} style={styles.contactLink}>
              {wrapText(displayUrl(personalInfo.linkedin, true))}
            </Link>
          </KeepTogether>

          {personalInfo.portfolio && (
            <KeepTogether style={[styles.contactItem, styles.contactItemLast]}>
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

const renderSkills: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { skills } = data;
  if (part === "title") {
    return <Text style={styles.h2}>Skills</Text>;
  }
  if (part === "item") {
    const i = itemIndex ?? 0;
    const group = skills[i];
    if (!group) return null;
    return (
      <KeepTogether
        key={group.id ?? i}
        style={[styles.skillGroup, i === skills.length - 1 ? styles.skillGroupLast : {}]}
      >
        <Text style={styles.skillCat}>{group.category}</Text>
        <DiffText
          oldText={originalData?.skills[i]?.items}
          newText={group.items}
          style={styles.skillList}
        />
      </KeepTogether>
    );
  }
  return (
    <>
      <Text style={styles.h2}>Skills</Text>
      {skills.map((group, i) => (
        <KeepTogether
          key={group.id ?? i}
          style={[styles.skillGroup, i === skills.length - 1 ? styles.skillGroupLast : {}]}
        >
          <Text style={styles.skillCat}>{group.category}</Text>
          <DiffText
            oldText={originalData?.skills[i]?.items}
            newText={group.items}
            style={styles.skillList}
          />
        </KeepTogether>
      ))}
    </>
  );
};

const renderLanguages: SectionRenderer = (data, styles, originalData, part) => {
  const { spokenLanguages } = data;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <Text style={styles.h2}>Languages</Text>}
      {showContent && (
        <View style={styles.sideBlock}>
          {spokenLanguages.map((lang, i) => (
            <Text key={i} style={styles.sideBlockText}>
              {lang}
            </Text>
          ))}
        </View>
      )}
    </>
  );
};

const renderEducation: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { education } = data;
  if (part === "title") {
    return <Text style={styles.h2}>Education</Text>;
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
          styles.sideBlock,
          edu.customMarginBottom !== undefined ? { marginBottom: edu.customMarginBottom } : {},
        ]}
      >
        <Text style={styles.sideBlockLead}>{edu.degree}</Text>
        <Text style={styles.sideBlockSub}>{edu.institution}</Text>
      </KeepTogether>
    );
  }
  return (
    <>
      <Text style={styles.h2}>Education</Text>
      {education.map((edu, i) => (
        <KeepTogether
          key={edu.id ?? i}
          break={edu.forcePageBreak}
          style={[
            styles.sideBlock,
            edu.customMarginBottom !== undefined ? { marginBottom: edu.customMarginBottom } : {},
          ]}
        >
          <Text style={styles.sideBlockLead}>{edu.degree}</Text>
          <Text style={styles.sideBlockSub}>{edu.institution}</Text>
        </KeepTogether>
      ))}
    </>
  );
};

const renderSummary: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <Text style={styles.h2}>Summary</Text>}
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

const renderExperience: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { experiences } = data;
  if (part === "title") {
    return <Text style={styles.h2}>Experience</Text>;
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
      <Text style={styles.h2}>Experience</Text>
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

const renderProjects: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { projects } = data;
  if (part === "title") {
    return <Text style={styles.h2}>Projects</Text>;
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
      <Text style={styles.h2}>Projects</Text>
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

const renderCertifications: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  if (!personalInfo.certifications) return null;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <Text style={styles.h2}>Certifications</Text>}
      {showContent && (
        <View style={styles.sideBlock}>
          {personalInfo.certifications.split(",").map((cert, i) => (
            <Text key={i} style={styles.sideBlockText}>
              {cert.trim()}
            </Text>
          ))}
        </View>
      )}
    </>
  );
};

const renderInterests: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  if (!personalInfo.interests) return null;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <Text style={styles.h2}>Intérêts</Text>}
      {showContent && (
        <View style={styles.sideBlock}>
          {personalInfo.interests.split(/[·,]/).map((interest, i) => (
            <Text key={i} style={styles.sideBlockText}>
              • {interest.trim()}
            </Text>
          ))}
        </View>
      )}
    </>
  );
};

// Registre : ID de section → renderer. Ajouter une section = une entrée ici.
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

// Rend une colonne (liste d'IDs de sections), en gérant la marge du dernier élément.
const renderColumn = (ids: string[], data: CVData, styles: any, originalData?: CVData) => {
  const known = ids.filter((id) => SECTION_RENDERERS[id]);
  return known.map((id, i) => {
    const rendered = SECTION_RENDERERS[id](data, styles, originalData);
    if (!rendered) return null;
    return (
      <View key={id} style={i === known.length - 1 ? styles.sectionLast : styles.section}>
        {rendered}
      </View>
    );
  });
};

// ─── Component ──────────────────────────────────────────────────────────────

interface CVTemplateProps {
  data: CVData;
  originalData?: CVData;
}

const CVTemplate: React.FC<CVTemplateProps> = ({ data, originalData }) => {
  const { personalInfo } = data;
  const layout = data.layout ?? defaultLayout();
  const sidebarWidth = layout.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
  const styles = getStyles(layout.theme, sidebarWidth);

  const useAbsolute = layout.useAbsolutePositioning || false;
  const absolutePositions = layout.absolutePositions || getDefaultPositions("default", data);


  const renderAbsoluteBlock = (blockId: string) => {
    const defaultPositions = getDefaultPositions("default", data);
    const pos = absolutePositions[blockId] || defaultPositions[blockId];
    if (!pos) return null;

    let rendered: React.ReactNode = null;
    if (blockId.startsWith("title_custom_") || blockId.startsWith("content_custom_")) {
      const isTitle = blockId.startsWith("title_");
      const sectionId = blockId.substring(isTitle ? 6 : 8);
      const cs = data.customSections?.find((c) => `custom_${c.id}` === sectionId);
      if (cs) {
        rendered = isTitle
          ? <Text style={styles.h2}>{cs.title}</Text>
          : <Text style={styles.summary}>{cs.content}</Text>;
      }
    } else if (blockId.startsWith("title_")) {
      const sectionId = blockId.substring(6);
      rendered = SECTION_RENDERERS[sectionId] ? SECTION_RENDERERS[sectionId](data, styles, originalData, "title") : null;
    } else if (blockId === "content_contact") {
      rendered = renderContact(data, styles, originalData, "content");
    } else if (blockId.startsWith("skill_")) {
      const match = blockId.match(/^skill_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1]);
        rendered = renderSkills(data, styles, originalData, "item", idx);
      }
    } else if (blockId === "content_languages") {
      rendered = renderLanguages(data, styles, originalData, "content");
    } else if (blockId.startsWith("education_")) {
      const match = blockId.match(/^education_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1]);
        rendered = renderEducation(data, styles, originalData, "item", idx);
      }
    } else if (blockId === "content_summary") {
      rendered = renderSummary(data, styles, originalData, "content");
    } else if (blockId.startsWith("experience_")) {
      const match = blockId.match(/^experience_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1]);
        rendered = renderExperience(data, styles, originalData, "item", idx);
      }
    } else if (blockId.startsWith("project_")) {
      const match = blockId.match(/^project_(\d+)$/);
      if (match) {
        const idx = parseInt(match[1]);
        rendered = renderProjects(data, styles, originalData, "item", idx);
      }
    } else if (blockId === "content_certifications") {
      rendered = renderCertifications(data, styles, originalData, "content");
    } else if (blockId === "content_interests") {
      rendered = renderInterests(data, styles, originalData, "content");
    }

    if (!rendered) return null;

    return (
      <View key={blockId} style={{ position: "absolute", left: pos.x, top: pos.y, width: pos.w }}>
        {rendered}
      </View>
    );
  };

  const renderAbsoluteHeaderAndPhoto = (pageIndex: number) => {
    if (pageIndex !== 0) return null;

    const namePos = absolutePositions.name || { x: 24, y: 16, w: 450 };
    const rolePos = absolutePositions.role || { x: 24, y: 46, w: 450 };
    const techPos = absolutePositions.techLine || { x: 24, y: 64, w: 450 };
    const photoPos = absolutePositions.photo || getDefaultPhotoPosition("default", sidebarWidth);

    return (
      <>
        {/* Name */}
        <View style={{ position: "absolute", left: namePos.x, top: namePos.y, width: namePos.w }}>
          <Text style={styles.h1}>{personalInfo.name}</Text>
        </View>

        {/* Role */}
        <View style={{ position: "absolute", left: rolePos.x, top: rolePos.y, width: rolePos.w }}>
          <Text style={styles.role}>{personalInfo.role}</Text>
        </View>

        {/* Tech Line */}
        <View style={{ position: "absolute", left: techPos.x, top: techPos.y, width: techPos.w }}>
          <DiffText
            oldText={originalData?.personalInfo.techLine}
            newText={personalInfo.techLine}
            style={styles.techLine}
          />
        </View>

        {/* Photo */}
        {personalInfo.photo && (
          <View style={{ position: "absolute", left: photoPos.x, top: photoPos.y, width: photoPos.w ?? 60, alignItems: "center" }}>
            <View style={{ width: photoPos.w ?? 60, height: photoPos.w ?? 60, borderRadius: (photoPos.w ?? 60) / 2, overflow: "hidden", borderWidth: 1, borderColor: "#c4c4c4" }}>
              <Image src={personalInfo.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
          </View>
        )}
      </>
    );
  };

  return (
    <Document
      title={`${personalInfo.name} — ${personalInfo.role} (CV)`}
      author={personalInfo.name}
      subject={personalInfo.role}
    >
      {layout.pages.map((page, pageIndex) => {
        // Pas de section en colonne latérale → la colonne principale occupe
        // toute la largeur (équivalent du `fullWidth` de Reactive Resume).
        const hasSidebar = page.sidebar.some((id) => SECTION_RENDERERS[id]);

        if (useAbsolute) {
          // Honore la pagination auto (position.page) si présente.
          const { sidebar: sidebarBlocks, main: mainBlocks } = getPageBlockIds(layout, data, pageIndex);
          const hasSidebarAbs = sidebarBlocks.length > 0;
          const sidebarBgStyle = {
            position: "absolute" as const,
            left: 0,
            top: 0,
            width: sidebarWidth,
            height: "100%",
            backgroundColor: styles.sidebar.backgroundColor || "transparent",
          };

          return (
            <Page key={pageIndex} size="A4" style={[styles.page, { padding: 0 }]}>
              {hasSidebarAbs && styles.sidebar.backgroundColor !== "transparent" && <View style={sidebarBgStyle} />}
              {renderAbsoluteHeaderAndPhoto(pageIndex)}
              {sidebarBlocks.map((blockId) => renderAbsoluteBlock(blockId))}
              {mainBlocks.map((blockId) => renderAbsoluteBlock(blockId))}
            </Page>
          );
        }

        return (
          <Page key={pageIndex} size="A4" style={styles.page}>
            {/* Header (nom / rôle / techLine) : uniquement sur la 1re page. */}
            {pageIndex === 0 && (
              <View style={styles.header}>
                <Text style={styles.h1}>{personalInfo.name}</Text>
                <Text style={styles.role}>{personalInfo.role}</Text>
                <DiffText
                  oldText={originalData?.personalInfo.techLine}
                  newText={personalInfo.techLine}
                  style={styles.techLine}
                />
              </View>
            )}

            <View style={styles.body}>
              {hasSidebar && (
                <View style={[styles.sidebar, { width: sidebarWidth }]}>
                  {pageIndex === 0 && personalInfo.photo && (
                    <View style={{ alignItems: "center", marginBottom: 12 }}>
                      <View style={{ width: 60, height: 60, borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: "#c4c4c4" }}>
                        <Image src={personalInfo.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </View>
                    </View>
                  )}
                  {renderColumn(page.sidebar, data, styles, originalData)}
                </View>
              )}
              <View style={styles.main}>{renderColumn(page.main, data, styles, originalData)}</View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default CVTemplate;
