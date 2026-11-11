import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions,
  type ParagraphChild,
} from "docx";
import type { CVData } from "@/types/cv";
import { getSectionLabel } from "@/lib/cv-layout";
import { readingOrderSectionIds } from "@/lib/cv-text";
import { parseInlineHtml, type RichTextRun } from "@/utils/inline-html";
import { stripHtml } from "@/utils/strip-html";

/**
 * Export DOCX du CV (C11) : mise en page simple à une colonne, dans le même
 * ordre de lecture que l'export texte (les ATS lisent mieux une colonne), sans
 * reproduire le canvas absolu. Le gras, l'italique, le souligné, le barré, la
 * couleur, la taille et les liens des champs riches viennent de
 * `parseInlineHtml`, comme dans le PDF.
 */

const FONT = "Calibri";
const MUTED = "6B7280";

/** Couleur CSS (#rgb, #rrggbb, rgb()) → hexadécimal Word sans « # ». */
export function cssColorToHex(c?: string): string | undefined {
  if (!c) return undefined;
  const v = c.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) return m[1].split("").map((x) => x + x).join("").toUpperCase();
  m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) return m[1].toUpperCase();
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(v);
  if (rgb) return rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("").toUpperCase();
  return undefined;
}

const plain = (s?: string): string => stripHtml(s ?? "").replace(/ /g, " ").trim();

interface RunBase {
  size: number; // demi-points
  bold?: boolean;
  italics?: boolean;
  color?: string;
}

/** Un run du parseur → TextRun(s) Word ; les « \n » deviennent des sauts de ligne. */
function toTextRuns(run: RichTextRun, base: RunBase): TextRun[] {
  const st = run.style ?? {};
  const deco = st.textDecoration ?? "";
  const parts = run.text.split("\n");
  return parts.map(
    (text, i) =>
      new TextRun({
        text,
        break: i > 0 ? 1 : undefined,
        font: FONT,
        size: st.fontSize ? Math.round(st.fontSize * 2) : base.size,
        bold: st.fontWeight ? st.fontWeight === "bold" : base.bold,
        italics: st.fontStyle ? st.fontStyle === "italic" : base.italics,
        underline: deco.includes("underline") || st.href ? {} : undefined,
        strike: deco.includes("line-through") || undefined,
        color: cssColorToHex(st.color) ?? (st.href ? "1D4ED8" : base.color),
      }),
  );
}

/** Texte riche (HTML inline de l'éditeur) → enfants de paragraphe. */
function richChildren(html: string | undefined, base: RunBase): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const run of parseInlineHtml(html ?? "")) {
    const runs = toTextRuns(run, base);
    const href = run.style?.href;
    if (href) out.push(new ExternalHyperlink({ link: href, children: runs }));
    else out.push(...runs);
  }
  return out;
}

/** Retire les sauts de ligne de fin (un </li> final en ajoute un). */
function trimTrailingBreaks(html: string): string {
  return html.replace(/(<br\s*\/?>|\s)+$/i, "");
}

function para(children: ParagraphChild[], opts: Omit<IParagraphOptions, "children"> = {}): Paragraph {
  return new Paragraph({ spacing: { after: 60 }, ...opts, children });
}

/** Paragraphe riche ; vide si le champ n'a pas de texte. */
function richPara(html: string | undefined, base: RunBase, opts?: Omit<IParagraphOptions, "children">): Paragraph[] {
  if (!plain(html)) return [];
  return [para(richChildren(trimTrailingBreaks(html ?? ""), base), opts)];
}

/** Ligne « Titre — Organisation » en gras + date grisée à la ligne. */
function entryHeader(main: string[], date: string | undefined, base: RunBase): Paragraph[] {
  const children: ParagraphChild[] = [];
  main.filter((m) => plain(m)).forEach((m, i) => {
    if (i > 0) children.push(new TextRun({ text: " — ", font: FONT, size: base.size, bold: true }));
    children.push(...richChildren(m, { ...base, bold: true }));
  });
  const out = children.length ? [para(children, { spacing: { before: 100, after: 20 }, keepNext: true })] : [];
  if (plain(date)) out.push(para([new TextRun({ text: plain(date), font: FONT, size: base.size - 2, italics: true, color: MUTED })], { spacing: { after: 40 }, keepNext: true }));
  return out;
}

function sectionParagraphs(id: string, data: CVData, base: RunBase): Paragraph[] {
  const pi = data.personalInfo;
  switch (id) {
    case "summary":
      return richPara(pi.summary, base);
    case "contact":
      return [pi.email, pi.phone, pi.location, pi.linkedin, pi.portfolio].flatMap((v) => richPara(v, base, { spacing: { after: 20 } }));
    case "experience":
      return data.experiences.flatMap((e) => [
        ...entryHeader([e.title, e.org], e.date, base),
        ...e.bullets.flatMap((b) => richPara(b, base, { bullet: { level: 0 }, spacing: { after: 20 } })),
      ]);
    case "projects":
      return data.projects.flatMap((p) => [
        ...entryHeader([p.title], undefined, base),
        ...richPara(p.description, base),
        ...(plain(p.stack)
          ? [para([new TextRun({ text: "Stack : ", font: FONT, size: base.size, bold: true }), ...richChildren(p.stack, base)])]
          : []),
      ]);
    case "skills":
      return data.skills
        .filter((s) => plain(s.category) || plain(s.items))
        .map((s) =>
          para([
            ...(plain(s.category) ? [...richChildren(s.category, { ...base, bold: true }), new TextRun({ text: " : ", font: FONT, size: base.size, bold: true })] : []),
            ...richChildren(s.items, base),
          ], { spacing: { after: 20 } }),
        );
    case "languages":
      return data.spokenLanguages.flatMap((l) => richPara(l, base, { spacing: { after: 20 } }));
    case "education":
      return data.education.flatMap((e) => entryHeader([e.degree, e.institution], e.date, base));
    case "certifications":
      return richPara(pi.certifications, base);
    case "interests":
      return richPara(pi.interests, base);
    default:
      if (id.startsWith("custom_")) {
        const cs = data.customSections?.find((c) => `custom_${c.id}` === id);
        return richPara(cs?.content, base);
      }
      return [];
  }
}

/** Construit le document Word du CV. */
export function buildCvDocx(data: CVData): Document {
  const theme = data.layout?.theme ?? {};
  const base: RunBase = { size: Math.round((theme.fontSize ?? 10.5) * 2), color: cssColorToHex(theme.textColor) };
  const accent = cssColorToHex(theme.primaryColor) ?? "1F2937";
  const pi = data.personalInfo;

  const children: Paragraph[] = [];
  if (plain(pi.name)) {
    children.push(para(richChildren(pi.name, { ...base, size: 40, bold: true, color: accent }), { spacing: { after: 40 } }));
  }
  children.push(...richPara(pi.role, { ...base, size: base.size + 6 }, { spacing: { after: 40 } }));
  children.push(...richPara(pi.techLine, { ...base, color: MUTED }, { spacing: { after: 120 } }));

  for (const id of readingOrderSectionIds(data)) {
    const body = sectionParagraphs(id, data, base);
    if (!body.length) continue;
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        keepNext: true,
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 2 } },
        children: [new TextRun({ text: plain(getSectionLabel(id, data)).toUpperCase(), font: FONT, size: base.size + 4, bold: true, color: accent })],
      }),
      ...body,
    );
  }

  return new Document({
    creator: plain(pi.name) || "Kompyle",
    title: [plain(pi.name), plain(pi.role)].filter(Boolean).join(" — ") || "CV",
    description: "CV",
    styles: { default: { document: { run: { font: FONT, size: base.size } } } },
    sections: [
      {
        // Marges de 1,8 cm (1 cm = 567 twips).
        properties: { page: { margin: { top: 1020, bottom: 1020, left: 1020, right: 1020 } } },
        children,
      },
    ],
  });
}

export async function cvToDocxBuffer(data: CVData): Promise<Buffer> {
  return Packer.toBuffer(buildCvDocx(data));
}

