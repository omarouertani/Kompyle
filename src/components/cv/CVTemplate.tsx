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
import { registerPdfFont, ACTIVE_PDF_FONT } from "@/utils/pdf-fonts";
import type { CVData } from "@/types/cv";
import { defaultLayout, DEFAULT_SIDEBAR_WIDTH } from "@/lib/cv-layout";
import { diffWords } from "diff";

// Enregistre la police active (idempotent + robuste, césure désactivée incluse).
// Pour changer de police sur tout le CV : ACTIVE_PDF_FONT dans utils/pdf-fonts.ts.
registerPdfFont(ACTIVE_PDF_FONT);

const wrapText = (text: string, chars = "/\\-@\\.") => {
  if (!text) return "";
  const zwsp = String.fromCharCode(0x200b); // zero-width space (U+200B)
  const regex = new RegExp(`([${chars}])`, "g");
  return text.replace(regex, "$1" + zwsp);
};

const formatUrl = (url: string) => {
  if (!url) return "";
  return url.startsWith("http") ? url : `https://${url}`;
};

const displayUrl = (url: string, isLinkedIn = false) => {
  if (!url) return "";
  let clean = url.replace(/^(https?:\/\/)?(www\.)?/, "");
  if (isLinkedIn) {
    clean = clean.replace(/^linkedin\.com\/in\//i, "");
  }
  if (clean.endsWith("/")) clean = clean.slice(0, -1);
  return clean;
};

// ─── Diff Component ─────────────────────────────────────────────────────────
const DiffText = ({
  oldText,
  newText,
  style,
}: {
  oldText?: string;
  newText: string;
  style?: any;
}) => {
  if (oldText === undefined || oldText === newText) {
    return <Text style={style}>{newText}</Text>;
  }

  const chunks = diffWords(oldText, newText);
  return (
    <Text style={style}>
      {chunks.map((chunk, i) => {
        if (chunk.added) {
          return (
            <Text key={i} style={{ color: "green" }}>
              [+ {chunk.value}]
            </Text>
          );
        }
        if (chunk.removed) {
          return (
            <Text
              key={i}
              style={{
                color: "red",
                textDecoration: "line-through",
              }}
            >
              [- {chunk.value}]
            </Text>
          );
        }
        return <Text key={i}>{chunk.value}</Text>;
      })}
    </Text>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────
// NB : la `fontFamily` n'est plus répétée ici — elle est injectée globalement
// par les primitives (depuis le thème). Pour changer de police : un seul point
// (le thème), pas ces ~12 styles. Voir components/pdf-primitives/theme.tsx.
const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 24,
    paddingRight: 24,
  },

  /* ---------- Header ---------- */
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 4,
    marginBottom: 4,
  },
  h1: {
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: -0.2,
    marginBottom: 1,
    // lineHeight ≥ ~1.2 requis : `safeTextStyle` (overflow:hidden) rognerait
    // sinon les jambages (y, j, g) du nom.
    lineHeight: 1.25,
  },
  role: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 1,
    lineHeight: 1.25,
  },
  techLine: {
    fontSize: 10,
    color: "#555555",
    marginBottom: 1,
  },

  /* ---------- Two-column layout ---------- */
  body: {
    flexDirection: "row",
    columnGap: 24,
  },
  sidebar: {
    width: DEFAULT_SIDEBAR_WIDTH,
    flexShrink: 0,
    flexGrow: 0,
  },
  main: {
    flex: 1,
  },

  /* ---------- Sections ---------- */
  section: {
    marginBottom: 5,
  },
  sectionLast: {
    marginBottom: 0,
  },
  h2: {
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
    paddingBottom: 1,
    borderBottomWidth: 0.75,
    borderBottomColor: "#c4c4c4",
    // Majuscules sans jambage → on peut garder l'interligne serré.
    lineHeight: 1.15,
  },

  /* ---------- Contact ---------- */
  contactItem: {
    marginBottom: 3,
  },
  contactItemLast: {
    marginBottom: 0,
  },
  contactLabel: {
    fontSize: 8,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "#777777",
    marginBottom: 0,
    lineHeight: 1,
  },
  contactValue: {
    fontSize: 11,
    color: "#1a1a1a",
    lineHeight: 1.15,
  },
  contactLink: {
    fontSize: 11,
    color: "#1a1a1a",
    lineHeight: 1.15,
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
    fontSize: 11,
    marginBottom: 1,
  },
  skillList: {
    fontSize: 11,
    color: "#555555",
    lineHeight: 1.15,
  },

  /* ---------- Side block (languages, education) ---------- */
  sideBlock: {
    marginBottom: 4,
  },
  sideBlockText: {
    fontSize: 11,
    marginBottom: 1,
  },
  sideBlockLead: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 1,
    lineHeight: 1.15,
  },
  sideBlockSub: {
    fontSize: 11,
    color: "#555555",
    lineHeight: 1.15,
  },

  /* ---------- Summary ---------- */
  summary: {
    textAlign: "justify",
    fontSize: 12,
    lineHeight: 1.15,
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
    lineHeight: 1.15,
  },
  entryTitle: {
    fontWeight: "bold",
    fontSize: 12,
  },
  entryOrg: {
    fontWeight: "bold",
    color: "#1a1a1a",
    fontSize: 12,
  },
  // Conteneur rigide : garde la date sur une seule ligne malgré le flexShrink:1
  // imposé par safeTextStyle sur le <Text> interne.
  entryDateWrap: {
    flexShrink: 0,
    paddingTop: 1,
  },
  entryDate: {
    fontSize: 10,
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
    fontSize: 12,
    color: "#777777",
    lineHeight: 1.15,
  },
  bulletText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 1.15,
    textAlign: "justify",
  },

  /* ---------- Projects ---------- */
  projTitle: {
    fontWeight: "bold",
    fontSize: 12,
    marginBottom: 1,
  },
  projDesc: {
    fontSize: 12,
    marginBottom: 1,
    lineHeight: 1.15,
    textAlign: "justify",
  },
  projStack: {
    color: "#555555",
    fontSize: 10.5,
  },
  projStackBold: {
    fontWeight: "bold",
    color: "#1a1a1a",
  },
});

// ─── Section renderers ───────────────────────────────────────────────────────
// Chaque section = une fonction (data, originalData) → contenu (titre + corps).
// Le template les rend dans l'ordre/colonne/page définis par `data.layout`.
// Conserve EXACTEMENT le rendu d'origine + le surlignage des diffs (DiffText).

type SectionRenderer = (data: CVData, originalData?: CVData) => React.ReactNode;

const renderContact: SectionRenderer = (data) => {
  const { personalInfo } = data;
  return (
    <>
      <Text style={styles.h2}>Contact</Text>

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
  );
};

const renderSkills: SectionRenderer = (data, originalData) => {
  const { skills } = data;
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

const renderLanguages: SectionRenderer = (data) => {
  const { spokenLanguages } = data;
  return (
    <>
      <Text style={styles.h2}>Languages</Text>
      <View style={styles.sideBlock}>
        {spokenLanguages.map((lang, i) => (
          <Text key={i} style={styles.sideBlockText}>
            {lang}
          </Text>
        ))}
      </View>
    </>
  );
};

const renderEducation: SectionRenderer = (data) => {
  const { education } = data;
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

const renderSummary: SectionRenderer = (data, originalData) => {
  const { personalInfo } = data;
  return (
    <>
      <Text style={styles.h2}>Summary</Text>
      <DiffText
        oldText={originalData?.personalInfo.summary}
        newText={personalInfo.summary}
        style={styles.summary}
      />
    </>
  );
};

const renderExperience: SectionRenderer = (data, originalData) => {
  const { experiences } = data;
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
          {/* Title — Org  |  Date (en-tête gardé atomique) */}
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

          {/* Bullets */}
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

const renderProjects: SectionRenderer = (data, originalData) => {
  const { projects } = data;
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

// Registre : ID de section → renderer. Ajouter une section = une entrée ici.
const SECTION_RENDERERS: Record<string, SectionRenderer> = {
  contact: renderContact,
  skills: renderSkills,
  languages: renderLanguages,
  education: renderEducation,
  summary: renderSummary,
  experience: renderExperience,
  projects: renderProjects,
};

// Rend une colonne (liste d'IDs de sections), en gérant la marge du dernier élément.
const renderColumn = (ids: string[], data: CVData, originalData?: CVData) => {
  const known = ids.filter((id) => SECTION_RENDERERS[id]);
  return known.map((id, i) => (
    <View key={id} style={i === known.length - 1 ? styles.sectionLast : styles.section}>
      {SECTION_RENDERERS[id](data, originalData)}
    </View>
  ));
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
                  {renderColumn(page.sidebar, data, originalData)}
                </View>
              )}
              <View style={styles.main}>{renderColumn(page.main, data, originalData)}</View>
            </View>
          </Page>
        );
      })}
    </Document>
  );
};

export default CVTemplate;
