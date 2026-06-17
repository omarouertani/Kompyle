import type { CVData } from "@/types/cv";
import { stripHtml } from "@/utils/strip-html";

/**
 * Prépare un CV avant de l'envoyer à l'IA dans un prompt.
 *
 * On retire :
 *  - `layout` : piloté par l'utilisateur, sans intérêt analytique pour l'IA ;
 *  - `personalInfo.photo` : image (Base64 ou URL) potentiellement volumineuse qui
 *    gonflerait inutilement le contexte. L'IA n'en a aucun besoin, et les routes qui
 *    renvoient un CV ré-attachent la photo d'origine côté sortie.
 *
 * Ne mute pas l'entrée : renvoie une copie superficielle adaptée au prompt.
 */
export function cvForAiPrompt(cvData: CVData): Omit<CVData, "layout"> {
  const { layout: _layout, personalInfo, ...rest } = cvData;
  const { photo: _photo, ...personalInfoNoPhoto } = personalInfo;
  return { ...rest, personalInfo: personalInfoNoPhoto };
}

/** Découpe une chaîne de compétences/stack en tokens propres (virgules, '·', '/', '|'). */
function tokenizeSkillString(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;·•|/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Construit une "surface de mots-clés" à plat, pensée pour un LLM faisant de
 * l'analyse ATS. Le problème "Lost in the Middle" vient du fait que les
 * compétences sont enfouies dans des tableaux imbriqués (skills.items en
 * chaîne CSV, projects.stack, experiences.bullets). On les remonte ici en une
 * liste linéaire, dédupliquée par section, facile à scanner — sans rien
 * inventer ni supprimer : c'est un index, pas un résumé.
 *
 * Ce bloc est injecté EN PLUS du JSON complet pour maximiser le rappel des
 * compétences réellement présentes (anti faux-négatifs).
 */
export function buildAtsKeywordSurface(cvData: CVData): string {
  const lines: string[] = [];

  // Compétences déclarées — une ligne par catégorie, tokens individualisés.
  if (cvData.skills?.length) {
    lines.push("SKILLS (from skills[]):");
    for (const group of cvData.skills) {
      const tokens = tokenizeSkillString(group.items);
      if (tokens.length === 0) continue;
      const category = group.category?.trim() || "Uncategorized";
      lines.push(`- ${category}: ${tokens.join(", ")}`);
    }
  }

  // Stacks techniques des projets — souvent là où se cachent Dapr, gRPC, etc.
  const projectStacks = (cvData.projects ?? [])
    .map((p) => ({ title: p.title?.trim() || "Untitled project", tokens: tokenizeSkillString(p.stack) }))
    .filter((p) => p.tokens.length > 0);
  if (projectStacks.length) {
    lines.push("");
    lines.push("PROJECT TECH STACKS (from projects[].stack):");
    for (const p of projectStacks) {
      lines.push(`- ${p.title}: ${p.tokens.join(", ")}`);
    }
  }

  // Sections libres (custom) — l'utilisateur peut y mettre des mots-clés (outils,
  // méthodos…) qu'aucun champ structuré ne couvre. On les remonte aussi.
  const customs = (cvData.customSections ?? [])
    .map((c) => ({ title: stripHtml(c.title || "").trim() || "Section", content: stripHtml(c.content || "").trim() }))
    .filter((c) => c.content);
  if (customs.length) {
    lines.push("");
    lines.push("CUSTOM SECTIONS (from customSections[]):");
    for (const c of customs) lines.push(`- ${c.title}: ${c.content}`);
  }

  // Ligne technique du header — souvent une concentration de mots-clés.
  const techLine = cvData.personalInfo?.techLine?.trim();
  if (techLine) {
    lines.push("");
    lines.push(`HEADLINE TECH (from personalInfo.techLine): ${techLine}`);
  }

  if (lines.length === 0) return "(no explicit skills or tech stacks declared)";
  return lines.join("\n");
}
