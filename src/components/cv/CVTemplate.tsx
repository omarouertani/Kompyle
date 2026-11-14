import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Link,
  PdfThemeProvider,
  defaultPdfTheme,
} from "@/components/pdf-primitives";
import { registerPdfFont, ACTIVE_PDF_FONT, resolvePdfFontFamily } from "@/utils/pdf-fonts";
import type { CVData } from "@/types/cv";
import { defaultLayout, DEFAULT_SIDEBAR_WIDTH, getDefaultPositions, dedupePages, getPageBlockIds } from "@/lib/cv-layout";
import { DiffText, RichText, formatUrl, displayUrl, hasInlineHtml } from "@/utils/pdf-text-utils";
import { getStyles, type CVTemplateVariant } from "./template/classic-styles";
import { makeScaledStyles, scaleOf } from "./template/scaled-styles";
import {
  SECTION_RENDERERS,
  renderColumn,
  renderContact,
  renderSkills,
  renderLanguages,
  renderEducation,
  renderSummary,
  renderExperience,
  renderProjects,
  renderCertifications,
  renderInterests,
} from "./template/classic-renderers";
import { blockTextAlign, isBlockOutOfPage, pdfMetadata } from "./template/shared";
import { renderFreeElementsPdf, renderStackedPdf } from "./template/free-elements-pdf";
import { getPageDims } from "@/lib/page-size";
import { cvLanguage } from "@/lib/cv-i18n";

registerPdfFont(ACTIVE_PDF_FONT);

export type { CVTemplateVariant };

interface CVTemplateProps {
  data: CVData;
  originalData?: CVData;
  /** "canadian" = variante sobre nord-américaine (sans photo). */
  variant?: CVTemplateVariant;
}

const CVTemplate: React.FC<CVTemplateProps> = ({ data, originalData, variant = "classic" }) => {
  const { personalInfo } = data;
  const isCanadian = variant === "canadian";
  const layout = data.layout ?? defaultLayout();
  const sidebarWidth = layout.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH;
  const styles = getStyles(layout.theme, sidebarWidth, variant);
  // Bloc agrandi/réduit dans le canvas (fontScale) : mêmes proportions ici.
  const stylesFor = makeScaledStyles((th) => getStyles(th, sidebarWidth, variant), layout.theme, 10, styles);
  // Ce template (« Sans photo » + Canadien) n'affiche JAMAIS de photo.
  // Seul le template Moderne (CVTemplateModern) gère la photo.
  // Police du thème (canvas) → famille PDF enregistrée, injectée via le
  // contexte du thème PDF (toutes les primitives en héritent).
  const pdfFontFamily = resolvePdfFontFamily(layout.theme?.fontFamily);
  // Format de page (A4 / Letter) et langue du document (métadonnées PDF).
  const pageDims = getPageDims(layout);
  const cvLang = cvLanguage(data);

  // Le PDF rend depuis les positions absolues dès qu'elles existent, afin que la
  // sortie PDF corresponde EXACTEMENT à ce que l'utilisateur voit dans le canvas
  // (mêmes coordonnées, même hauteur de page A4) — fini l'écart d'espacement
  // entre l'aperçu canvas et le PDF.
  const useAbsolute =
    layout.useAbsolutePositioning ||
    !!(layout.absolutePositions && Object.keys(layout.absolutePositions).length > 0);
  const absolutePositions = layout.absolutePositions || getDefaultPositions(isCanadian ? "canadian" : "default", data);

  /** En-tête canadien : ligne de coordonnées minimaliste, sans étiquettes —
   *  Téléphone · Email · LinkedIn · Ville/Province. Email et LinkedIn restent
   *  cliquables (liens), le reste en texte sélectionnable (ATS-friendly). */
  const renderCanadianContact = (): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const push = (node: React.ReactNode) => {
      if (parts.length > 0) {
        parts.push(
          <Text key={`sep-${parts.length}`} style={styles.contactHeaderSep}>·</Text>
        );
      }
      parts.push(node);
    };
    if (personalInfo.phone) push(<Text key="phone" style={styles.contactHeaderItem}>{personalInfo.phone}</Text>);
    if (personalInfo.email) push(<Link key="email" src={`mailto:${personalInfo.email}`} style={styles.contactHeaderLink}>{personalInfo.email}</Link>);
    if (personalInfo.linkedin) push(<Link key="linkedin" src={formatUrl(personalInfo.linkedin)} style={styles.contactHeaderLink}>{hasInlineHtml(personalInfo.linkedin) ? personalInfo.linkedin : displayUrl(personalInfo.linkedin, true)}</Link>);
    if (personalInfo.location) push(<Text key="location" style={styles.contactHeaderItem}>{personalInfo.location}</Text>);
    if (parts.length === 0) return null;
    return <View style={styles.contactHeader}>{parts}</View>;
  };


  const renderAbsoluteBlock = (blockId: string) => {
    const defaultPositions = getDefaultPositions("default", data);
    const pos = absolutePositions[blockId] || defaultPositions[blockId];
    if (!pos) return null;
    // Position hors page A4 : on ignore le bloc plutôt que de casser le rendu
    // PDF (page blanche). Le canvas signale la limite (ligne ambre).
    if (isBlockOutOfPage(pos, pageDims)) return null;
    const styles = stylesFor(scaleOf(pos));

    let rendered: React.ReactNode = null;
    if (blockId.startsWith("title_custom_") || blockId.startsWith("content_custom_")) {
      const isTitle = blockId.startsWith("title_");
      const sectionId = blockId.substring(isTitle ? 6 : 8);
      const cs = data.customSections?.find((c) => `custom_${c.id}` === sectionId);
      if (cs) {
        // Custom-section title/content may contain inline format tags
        // (B/I/U/span color/font-size). RichText parses them; plain strings
        // pass through unchanged.
        rendered = isTitle
          ? <RichText style={styles.h2} value={cs.title} />
          : <RichText style={styles.summary} value={cs.content} />;
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
      <View key={blockId} style={{ position: "absolute", left: pos.x, top: pos.y, width: pos.w, textAlign: blockTextAlign(pos) }}>
        {rendered}
      </View>
    );
  };

  /** Bloc d'en-tête en mode absolu (page 1) : nom, rôle, ligne technique ou
   *  coordonnées (canadien). Un id par bloc pour l'ordre de superposition. */
  const renderAbsoluteHeaderBlock = (id: string): React.ReactNode => {
    const fallback: Record<string, { x: number; y: number; w: number }> = {
      name: { x: 24, y: 16, w: 450 },
      role: { x: 24, y: 46, w: 450 },
      techLine: { x: 24, y: 64, w: 450 },
      contactLine: { x: 24, y: 64, w: 547 },
    };
    const pos = absolutePositions[id] || fallback[id];
    if (!pos) return null;
    const styles = stylesFor(scaleOf(pos));
    let content: React.ReactNode = null;
    if (id === "name") content = <Text style={styles.h1}>{personalInfo.name}</Text>;
    else if (id === "role") content = <Text style={styles.role}>{personalInfo.role}</Text>;
    else if (id === "contactLine") content = renderCanadianContact();
    else if (id === "techLine") {
      content = (
        <DiffText
          oldText={originalData?.personalInfo.techLine}
          newText={personalInfo.techLine}
          style={styles.techLine}
        />
      );
    }
    return (
      <View key={id} style={{ position: "absolute", left: pos.x, top: pos.y, width: pos.w, textAlign: blockTextAlign(pos) }}>
        {content}
      </View>
    );
  };
  const absoluteHeaderIds = isCanadian ? ["name", "role", "contactLine"] : ["name", "role", "techLine"];

  return (
    <PdfThemeProvider value={{ ...defaultPdfTheme, fontFamily: pdfFontFamily }}>
    <Document {...pdfMetadata(data, cvLang)}>
      {dedupePages(layout.pages).map((page, pageIndex) => {
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
            <Page key={pageIndex} size={pageDims.id} style={[styles.page, { padding: 0 }]}>
              {hasSidebarAbs && styles.sidebar.backgroundColor !== "transparent" && <View style={sidebarBgStyle} />}
              {renderStackedPdf(
                layout,
                pageIndex,
                [...(pageIndex === 0 ? absoluteHeaderIds : []), ...sidebarBlocks, ...mainBlocks],
                (id) => (absoluteHeaderIds.includes(id) ? renderAbsoluteHeaderBlock(id) : renderAbsoluteBlock(id)),
              )}
            </Page>
          );
        }

        return (
          <Page key={pageIndex} size={pageDims.id} style={styles.page}>
            {/* Header (nom / rôle / techLine|coordonnées) : uniquement sur la 1re page. */}
            {pageIndex === 0 && (
              <View style={styles.header}>
                <Text style={styles.h1}>{personalInfo.name}</Text>
                <Text style={styles.role}>{personalInfo.role}</Text>
                {isCanadian ? (
                  renderCanadianContact()
                ) : (
                  <DiffText
                    oldText={originalData?.personalInfo.techLine}
                    newText={personalInfo.techLine}
                    style={styles.techLine}
                  />
                )}
              </View>
            )}

            <View style={styles.body}>
              {hasSidebar && (
                <View style={[styles.sidebar, { width: sidebarWidth }]}>
                  {renderColumn(page.sidebar, data, styles, originalData)}
                </View>
              )}
              <View style={styles.main}>{renderColumn(page.main, data, styles, originalData)}</View>
            </View>
            {renderFreeElementsPdf(layout, pageIndex)}
          </Page>
        );
      })}
    </Document>
    </PdfThemeProvider>
  );
};

export default CVTemplate;
