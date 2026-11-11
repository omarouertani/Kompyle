import type { CVData } from "@/types/cv";
import { dedupePages, defaultLayout, getSectionLabel } from "@/lib/cv-layout";
import { stripHtml } from "@/utils/strip-html";

/**
 * Export texte brut du CV (C11) : une seule colonne, dans l'ordre de lecture
 * (pour chaque page : colonne principale puis colonne latérale), sans mise en
 * forme. C'est le format que les ATS lisent le plus sûrement, et il sert aussi
 * à copier-coller le CV dans un formulaire de candidature.
 */

const clean = (s?: string): string =>
  stripHtml(s ?? "")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const lines = (...parts: Array<string | undefined>): string => parts.map(clean).filter(Boolean).join("\n");

function sectionBody(id: string, data: CVData): string {
  const pi = data.personalInfo;
  switch (id) {
    case "summary":
      return clean(pi.summary);
    case "contact":
      return lines(pi.email, pi.phone, pi.location, pi.linkedin, pi.portfolio);
    case "experience":
      return data.experiences
        .map((e) =>
          lines(
            [clean(e.title), clean(e.org)].filter(Boolean).join(" — "),
            e.date,
            ...e.bullets.map((b) => (clean(b) ? `- ${clean(b)}` : "")),
          ),
        )
        .filter(Boolean)
        .join("\n\n");
    case "projects":
      return data.projects
        .map((p) => lines(p.title, p.description, p.stack ? `Stack : ${clean(p.stack)}` : ""))
        .filter(Boolean)
        .join("\n\n");
    case "skills":
      return data.skills
        .map((s) => [clean(s.category), clean(s.items)].filter(Boolean).join(" : "))
        .filter(Boolean)
        .join("\n");
    case "languages":
      return data.spokenLanguages.map(clean).filter(Boolean).join("\n");
    case "education":
      return data.education
        .map((e) => lines([clean(e.degree), clean(e.institution)].filter(Boolean).join(" — "), e.date))
        .filter(Boolean)
        .join("\n\n");
    case "certifications":
      return clean(pi.certifications);
    case "interests":
      return clean(pi.interests);
    default:
      if (id.startsWith("custom_")) {
        const cs = data.customSections?.find((c) => `custom_${c.id}` === id);
        return clean(cs?.content);
      }
      return "";
  }
}

/**
 * Sections du CV dans l'ordre de lecture d'une seule colonne : pour chaque
 * page, colonne principale puis colonne latérale, sans doublon. Partagé par
 * l'export texte et l'export DOCX.
 */
export function readingOrderSectionIds(data: CVData): string[] {
  const layout = data.layout ?? defaultLayout();
  const seen = new Set<string>();
  for (const page of dedupePages(layout.pages)) {
    for (const id of [...page.main, ...page.sidebar]) seen.add(id);
  }
  return [...seen];
}

export function cvToPlainText(data: CVData): string {
  const pi = data.personalInfo;
  const out: string[] = [];
  const header = lines(pi.name, pi.role, pi.techLine);
  if (header) out.push(header);

  for (const id of readingOrderSectionIds(data)) {
    const body = sectionBody(id, data);
    if (!body) continue;
    const title = clean(getSectionLabel(id, data)).toUpperCase();
    out.push(`${title}\n${"-".repeat(Math.min(title.length, 40))}\n${body}`);
  }
  return out.join("\n\n") + "\n";
}
