import React from "react";
import { View, Text, Link, KeepTogether } from "@/components/pdf-primitives";
import type { CVData } from "@/types/cv";
import { wrapText, formatUrl, displayUrl, DiffText } from "@/utils/pdf-text-utils";
import { sectionTitle } from "./shared";

export type SectionRenderer = (
  data: CVData,
  isSidebar: boolean,
  styles: any,
  originalData?: CVData,
  part?: "title" | "content" | "item",
  itemIndex?: number
) => React.ReactNode;

export const renderContact: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
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

export const renderSkills: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
  const { skills } = data;
  const h2Style = isSidebar ? styles.h2Sidebar : styles.h2Main;
  // Le template Moderne affiche les tags par défaut (rendu historique) ;
  // theme.skillMode permet de basculer en texte ou en barres.
  const mode = data.layout?.theme?.skillMode ?? "tags";

  const renderItems = (group: (typeof skills)[number]) => {
    if (mode === "text") {
      return <Text style={styles.skillListText}>{group.items}</Text>;
    }
    const itemsArray = group.items.split(",").map((item) => item.trim()).filter(Boolean);
    if (mode === "bars") {
      return (
        <View>
          {itemsArray.map((item, idx) => (
            <View key={idx} style={styles.skillBarRow}>
              <Text style={styles.skillBarLabel}>{item}</Text>
              <View style={styles.skillBarTrack}>
                <View style={styles.skillBarFill} />
              </View>
            </View>
          ))}
        </View>
      );
    }
    return (
      <View style={styles.skillsContainer}>
        {itemsArray.map((item, idx) => (
          <View key={idx} style={styles.skillTag}>
            <Text style={styles.skillTagText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  if (part === "title") {
    return <Text style={h2Style}>{sectionTitle(data, "skills", "Compétences")}</Text>;
  }
  if (part === "item") {
    const i = itemIndex ?? 0;
    const group = skills[i];
    if (!group) return null;
    return (
      <KeepTogether key={group.id ?? i} style={styles.skillGroup}>
        <Text style={styles.skillCat}>{group.category}</Text>
        {renderItems(group)}
      </KeepTogether>
    );
  }
  return (
    <>
      <Text style={h2Style}>{sectionTitle(data, "skills", "Compétences")}</Text>
      {skills.map((group, i) => (
        <KeepTogether key={group.id ?? i} style={styles.skillGroup}>
          <Text style={styles.skillCat}>{group.category}</Text>
          {renderItems(group)}
        </KeepTogether>
      ))}
    </>
  );
};

export const renderLanguages: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
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

export const renderCertifications: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
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

export const renderInterests: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
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

export const renderSummary: SectionRenderer = (data, isSidebar, styles, originalData, part) => {
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

export const renderExperience: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
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

export const renderEducation: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
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

export const renderProjects: SectionRenderer = (data, isSidebar, styles, originalData, part, itemIndex) => {
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

export const SECTION_RENDERERS: Record<string, SectionRenderer> = {
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

export const renderColumn = (
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
