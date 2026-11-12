import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  PdfThemeProvider,
  defaultPdfTheme,
} from "@/components/pdf-primitives";
import { Svg, Circle, Path, Image } from "@react-pdf/renderer";
import { registerPdfFont, ACTIVE_PDF_FONT, resolvePdfFontFamily } from "@/utils/pdf-fonts";
import type { CVData } from "@/types/cv";
import { defaultLayout, getDefaultPositions, getDefaultPhotoPosition, getPageBlockIds, dedupePages } from "@/lib/cv-layout";
import { DiffText, RichText } from "@/utils/pdf-text-utils";
import { getStyles } from "./template/modern-styles";
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
} from "./template/modern-renderers";
import { blockTextAlign, isBlockOutOfPage, pdfMetadata } from "./template/shared";
import { renderFreeElementsPdf, renderStackedPdf } from "./template/free-elements-pdf";
import { getPageDims } from "@/lib/page-size";
import { photoFrame } from "@/lib/photo-frame";
import { detectJobLanguage } from "@/lib/detect-language";
import { stripHtml } from "@/utils/strip-html";

registerPdfFont(ACTIVE_PDF_FONT);

interface CVTemplateModernProps {
  data: CVData;
  originalData?: CVData;
}

const CVTemplateModern: React.FC<CVTemplateModernProps> = ({ data, originalData }) => {
  const { personalInfo } = data;
  const layout = data.layout ?? defaultLayout();
  const sidebarWidth = layout.sidebarWidth ?? 175;
  const styles = getStyles(layout.theme, sidebarWidth);
  // Bloc agrandi/réduit dans le canvas (fontScale) : mêmes proportions ici.
  const stylesFor = makeScaledStyles((th) => getStyles(th, sidebarWidth), layout.theme, 9.5, styles);
  // Police du thème (canvas) → famille PDF enregistrée, injectée via le
  // contexte du thème PDF (toutes les primitives en héritent).
  const pdfFontFamily = resolvePdfFontFamily(layout.theme?.fontFamily);
  // Format de page (A4 / Letter) et langue du document (métadonnées PDF).
  const pageDims = getPageDims(layout);
  // Cadre de la photo (forme + bordure), identique au canvas.
  const avatarFrame = (size: number) => {
    const f = photoFrame(layout.theme, size, layout.theme?.primaryColor || "#1a1a1a");
    return { width: size, height: size, borderRadius: f.radius, borderWidth: f.borderWidth, borderColor: f.borderColor };
  };
  const cvLanguage = detectJobLanguage(stripHtml(`${data.personalInfo?.role ?? ""} ${data.personalInfo?.summary ?? ""}`));

  return (
    <PdfThemeProvider value={{ ...defaultPdfTheme, fontFamily: pdfFontFamily }}>
    <Document {...pdfMetadata(data, cvLanguage)}>
      {dedupePages(layout.pages).map((page, pageIndex) => {
        const hasSidebar = page.sidebar.some((id) => SECTION_RENDERERS[id]);

        // Le PDF rend depuis les positions absolues dès qu'elles existent, afin
        // que la sortie PDF corresponde EXACTEMENT à ce que l'utilisateur voit
        // dans le canvas (mêmes coordonnées, même hauteur de page A4).
        const useAbsolute =
          layout.useAbsolutePositioning ||
          !!(layout.absolutePositions && Object.keys(layout.absolutePositions).length > 0);

        if (useAbsolute) {
          const absolutePositions = layout.absolutePositions || getDefaultPositions("modern", data);
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
          const renderAbsoluteHeaderBlock = (id: string): React.ReactNode => {
            const photoPos = absolutePositions.photo || getDefaultPhotoPosition("modern", sidebarWidth);
            const namePos = absolutePositions.name || { x: 200, y: 20, w: 370 };
            const rolePos = absolutePositions.role || { x: 200, y: 48, w: 370 };
            const techPos = absolutePositions.techLine || { x: 200, y: 66, w: 370 };
            const styles = stylesFor(scaleOf(({ name: namePos, role: rolePos, techLine: techPos } as Record<string, unknown>)[id]));
            if (id === "photo") return (
                <View key="photo" style={{ position: "absolute", left: photoPos.x, top: photoPos.y, width: photoPos.w ?? 65, alignItems: "center" }}>
                  <View style={[styles.avatarCircle, avatarFrame(photoPos.w ?? 65)]}>
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
            );
            if (id === "name") return (
                <View key="name" style={{ position: "absolute", left: namePos.x, top: namePos.y, width: namePos.w, textAlign: blockTextAlign(namePos) }}>
                  <Text style={styles.h1}>{personalInfo.name}</Text>
                </View>
            );
            if (id === "role") return (
                <View key="role" style={{ position: "absolute", left: rolePos.x, top: rolePos.y, width: rolePos.w, textAlign: blockTextAlign(rolePos) }}>
                  <Text style={styles.role}>{personalInfo.role}</Text>
                </View>
            );
            if (id === "techLine" && personalInfo.techLine) return (
                  <View key="techLine" style={{ position: "absolute", left: techPos.x, top: techPos.y, width: techPos.w, textAlign: blockTextAlign(techPos) }}>
                    <DiffText
                      oldText={originalData?.personalInfo.techLine}
                      newText={personalInfo.techLine}
                      style={styles.techLine}
                    />
                  </View>
            );
            return null;
          };
          const absoluteHeaderIds = ["photo", "name", "role", "techLine"];

          const renderAbsoluteBlock = (blockId: string, isSidebar: boolean) => {
            const defaultPositions = getDefaultPositions("modern", data);
            const pos = absolutePositions[blockId] || defaultPositions[blockId];
            if (!pos) return null;
            // Position hors page A4 : on ignore le bloc plutôt que de casser le
            // rendu PDF (page blanche / boucle de pagination).
            if (isBlockOutOfPage(pos, pageDims)) return null;
            const styles = stylesFor(scaleOf(pos));

            let rendered: React.ReactNode = null;
            // STEP: custom sections support
            if (blockId.startsWith("title_custom_") || blockId.startsWith("content_custom_")) {
              const isTitle = blockId.startsWith("title_");
              const sectionId = blockId.substring(isTitle ? 6 : 8);
              const cs = data.customSections?.find((c) => `custom_${c.id}` === sectionId);
              if (cs) {
                // Custom section title/content may contain inline format tags.
                rendered = isTitle
                  ? <RichText style={isSidebar ? styles.h2Sidebar : styles.h2Main} value={cs.title} />
                  : <RichText style={styles.summary} value={cs.content} />;
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
              <View key={blockId} style={{ position: "absolute", left: pos.x, top: pos.y, width: pos.w, textAlign: blockTextAlign(pos) }}>
                {rendered}
              </View>
            );
          };

          return (
            <Page key={pageIndex} size={pageDims.id} style={[styles.page, { padding: 0 }]}>
              {hasSidebarAbs && <View style={sidebarBgStyle} />}
              {renderStackedPdf(
                layout,
                pageIndex,
                [...(pageIndex === 0 ? absoluteHeaderIds : []), ...sidebarBlocks, ...mainBlocks],
                (id) =>
                  absoluteHeaderIds.includes(id)
                    ? renderAbsoluteHeaderBlock(id)
                    : renderAbsoluteBlock(id, sidebarBlocks.includes(id)),
                9.5,
              )}
            </Page>
          );
        }

        return (
          <Page key={pageIndex} size={pageDims.id} style={styles.page}>
            <View style={styles.body}>
              {hasSidebar && (
                <View style={styles.sidebar}>
                  {pageIndex === 0 && (
                    <View style={styles.avatarContainer}>
                      <View style={[styles.avatarCircle, avatarFrame(65)]}>
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
            {renderFreeElementsPdf(layout, pageIndex, 9.5)}
          </Page>
        );
      })}
    </Document>
    </PdfThemeProvider>
  );
};

export default CVTemplateModern;
