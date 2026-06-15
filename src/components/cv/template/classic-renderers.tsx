import React from "react";
import { View, Text, Link, KeepTogether } from "@/components/pdf-primitives";
import type { CVData } from "@/types/cv";
import { wrapText, formatUrl, displayUrl, DiffText, RichText, hasInlineHtml } from "@/utils/pdf-text-utils";
import { sectionTitle } from "./shared";

// ─── Section renderers ───────────────────────────────────────────────────────

export type SectionRenderer = (data: CVData, styles: any, originalData?: CVData, part?: "title" | "content" | "item", itemIndex?: number) => React.ReactNode;

export const renderContact: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <RichText style={styles.h2} value={sectionTitle(data, "contact", "Contact")} />}

      {showContent && (
        <>
          <KeepTogether style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email</Text>
            <Link src={`mailto:${personalInfo.email}`} style={styles.contactLink}>
              {hasInlineHtml(personalInfo.email) ? personalInfo.email : wrapText(personalInfo.email)}
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
              {hasInlineHtml(personalInfo.linkedin) ? personalInfo.linkedin : wrapText(displayUrl(personalInfo.linkedin, true))}
            </Link>
          </KeepTogether>

          {personalInfo.portfolio && (
            <KeepTogether style={[styles.contactItem, styles.contactItemLast]}>
              <Text style={styles.contactLabel}>Portfolio</Text>
              <Link src={formatUrl(personalInfo.portfolio)} style={styles.contactLink}>
                {hasInlineHtml(personalInfo.portfolio) ? personalInfo.portfolio : wrapText(displayUrl(personalInfo.portfolio))}
              </Link>
            </KeepTogether>
          )}
        </>
      )}
    </>
  );
};

export const renderSkills: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { skills } = data;
  const mode = data.layout?.theme?.skillMode ?? "text";

  // Items d'un groupe selon le mode choisi (texte brut, tags ou barres).
  const renderItems = (group: (typeof skills)[number], i: number) => {
    if (mode === "tags") {
      const itemsArray = group.items.split(",").map((s) => s.trim()).filter(Boolean);
      return (
        <View style={styles.skillTagWrap}>
          {itemsArray.map((item, idx) => (
            <View key={idx} style={styles.skillTag}>
              <Text style={styles.skillTagText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    }
    if (mode === "bars") {
      const itemsArray = group.items.split(",").map((s) => s.trim()).filter(Boolean);
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
      <DiffText
        oldText={originalData?.skills[i]?.items}
        newText={group.items}
        style={styles.skillList}
      />
    );
  };

  if (part === "title") {
    return <RichText style={styles.h2} value={sectionTitle(data, "skills", "Skills")} />;
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
        {renderItems(group, i)}
      </KeepTogether>
    );
  }
  return (
    <>
      <RichText style={styles.h2} value={sectionTitle(data, "skills", "Skills")} />
      {skills.map((group, i) => (
        <KeepTogether
          key={group.id ?? i}
          style={[styles.skillGroup, i === skills.length - 1 ? styles.skillGroupLast : {}]}
        >
          <Text style={styles.skillCat}>{group.category}</Text>
          {renderItems(group, i)}
        </KeepTogether>
      ))}
    </>
  );
};

export const renderLanguages: SectionRenderer = (data, styles, originalData, part) => {
  const { spokenLanguages } = data;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <RichText style={styles.h2} value={sectionTitle(data, "languages", "Languages")} />}
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

export const renderEducation: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { education } = data;
  if (part === "title") {
    return <RichText style={styles.h2} value={sectionTitle(data, "education", "Education")} />;
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
        {edu.date ? <Text style={styles.sideBlockSub}>{edu.date}</Text> : null}
      </KeepTogether>
    );
  }
  return (
    <>
      <RichText style={styles.h2} value={sectionTitle(data, "education", "Education")} />
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
          {edu.date ? <Text style={styles.sideBlockSub}>{edu.date}</Text> : null}
        </KeepTogether>
      ))}
    </>
  );
};

export const renderSummary: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <RichText style={styles.h2} value={sectionTitle(data, "summary", "Summary")} />}
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

export const renderExperience: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { experiences } = data;
  if (part === "title") {
    return <RichText style={styles.h2} value={sectionTitle(data, "experience", "Experience")} />;
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
      <RichText style={styles.h2} value={sectionTitle(data, "experience", "Experience")} />
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

export const renderProjects: SectionRenderer = (data, styles, originalData, part, itemIndex) => {
  const { projects } = data;
  if (part === "title") {
    return <RichText style={styles.h2} value={sectionTitle(data, "projects", "Projects")} />;
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
      <RichText style={styles.h2} value={sectionTitle(data, "projects", "Projects")} />
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

export const renderCertifications: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  if (!personalInfo.certifications) return null;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <RichText style={styles.h2} value={sectionTitle(data, "certifications", "Certifications")} />}
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

export const renderInterests: SectionRenderer = (data, styles, originalData, part) => {
  const { personalInfo } = data;
  if (!personalInfo.interests) return null;
  const showTitle = !part || part === "title";
  const showContent = !part || part === "content";
  return (
    <>
      {showTitle && <RichText style={styles.h2} value={sectionTitle(data, "interests", "Intérêts")} />}
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

// Rend une colonne (liste d'IDs de sections), en gérant la marge du dernier élément.
export const renderColumn = (ids: string[], data: CVData, styles: any, originalData?: CVData) => {
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
