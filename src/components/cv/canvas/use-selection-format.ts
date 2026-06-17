"use client";

import { useCallback } from "react";
import type { CVData } from "@/types/cv";
import { getSectionLabel, renameSection } from "@/lib/cv-layout";

/* ────────────────────────────────────────────────────────────────────────────
 * Formatage au niveau bloc, AU NIVEAU DONNÉE (pas le DOM).
 *
 * « Sélectionner un bloc » = appliquer le style à tout le texte de ses champs.
 * On transforme directement les chaînes HTML inline stockées dans CVData, en UN
 * SEUL onChange (pas de commit par éditeur → pas d'écrasement entre champs), et
 * de façon déterministe :
 *   • SET (couleur/police/taille/titre) : on RETIRE d'abord la propriété
 *     existante (sinon un span interne l'emporterait, ex. couleur), puis on
 *     enveloppe tout le champ → la nouvelle valeur s'applique uniformément.
 *   • TOGGLE (gras/italique/souligné/barré) : si le champ porte déjà la
 *     propriété → on la retire ; sinon on l'ajoute. Vraie bascule on/off.
 * Le format reste de l'HTML inline → le PDF le rend à l'identique.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Retire une déclaration CSS (`prop: …;`) de tous les attributs style d'une
 *  chaîne HTML, et supprime les `style=""` devenus vides. */
function stripDecl(html: string, prop: string): string {
  if (!html) return html;
  const declRe = new RegExp(`${prop}\\s*:[^;"]*;?`, "gi");
  return html.replace(/style\s*=\s*"([^"]*)"/gi, (_m, decls: string) => {
    const cleaned = decls
      .replace(declRe, "")
      .replace(/\s*;\s*;/g, ";")
      .trim()
      .replace(/^;|;$/g, "")
      .trim();
    return cleaned ? `style="${cleaned}"` : "";
  });
}

/** Le champ porte-t-il déjà cette propriété de style ? */
function hasDecl(html: string, prop: string): boolean {
  return new RegExp(`${prop}\\s*:`, "i").test(html || "");
}

/** Enveloppe tout le champ dans un span portant `prop: value` (en retirant
 *  d'abord la même propriété éventuelle, pour qu'elle s'applique réellement). */
function wrapProp(html: string, prop: string, value: string): string {
  if (!html) return html;
  const base = stripDecl(html, prop);
  return `<span style="${prop}: ${value}">${base}</span>`;
}

type FieldTransform = (s: string) => string;

/** Applique une transformation à TOUTES les chaînes éditables d'un bloc, en
 *  miroir du mapping de BlockContent.tsx. Renvoie un nouveau CVData. */
function applyToBlock(data: CVData, blockId: string, tf: FieldTransform): CVData {
  const pi = data.personalInfo;

  if (blockId === "name") return { ...data, personalInfo: { ...pi, name: tf(pi.name) } };
  if (blockId === "role") return { ...data, personalInfo: { ...pi, role: tf(pi.role) } };
  if (blockId === "techLine") return { ...data, personalInfo: { ...pi, techLine: tf(pi.techLine) } };
  if (blockId === "contactLine") {
    return { ...data, personalInfo: { ...pi, phone: tf(pi.phone), email: tf(pi.email), linkedin: tf(pi.linkedin), location: tf(pi.location) } };
  }
  if (blockId === "content_summary") return { ...data, personalInfo: { ...pi, summary: tf(pi.summary) } };
  if (blockId === "content_certifications") return { ...data, personalInfo: { ...pi, certifications: tf(pi.certifications ?? "") } };
  if (blockId === "content_interests") return { ...data, personalInfo: { ...pi, interests: tf(pi.interests ?? "") } };
  if (blockId === "content_contact") {
    return {
      ...data,
      personalInfo: {
        ...pi,
        email: tf(pi.email),
        phone: tf(pi.phone),
        location: tf(pi.location),
        linkedin: tf(pi.linkedin),
        ...(pi.portfolio !== undefined ? { portfolio: tf(pi.portfolio) } : {}),
      },
    };
  }
  if (blockId === "content_languages") return { ...data, spokenLanguages: data.spokenLanguages.map(tf) };

  if (blockId.startsWith("title_custom_") || blockId.startsWith("content_custom_")) {
    const isTitle = blockId.startsWith("title_");
    const sectionId = blockId.substring(isTitle ? 6 : 8);
    const idx = (data.customSections ?? []).findIndex((c) => `custom_${c.id}` === sectionId);
    if (idx < 0) return data;
    const next = [...data.customSections!];
    next[idx] = isTitle ? { ...next[idx], title: tf(next[idx].title) } : { ...next[idx], content: tf(next[idx].content) };
    return { ...data, customSections: next };
  }
  if (blockId.startsWith("title_")) {
    const sectionId = blockId.substring(6);
    return renameSection(data, sectionId, tf(getSectionLabel(sectionId, data)));
  }

  if (blockId.startsWith("skill_")) {
    const idx = parseInt(blockId.split("_")[1]);
    if (!data.skills[idx]) return data;
    const next = [...data.skills];
    next[idx] = { ...next[idx], category: tf(next[idx].category), items: tf(next[idx].items) };
    return { ...data, skills: next };
  }
  if (blockId.startsWith("experience_")) {
    const idx = parseInt(blockId.split("_")[1]);
    if (!data.experiences[idx]) return data;
    const next = [...data.experiences];
    next[idx] = { ...next[idx], title: tf(next[idx].title), org: tf(next[idx].org), bullets: next[idx].bullets.map(tf) };
    return { ...data, experiences: next };
  }
  if (blockId.startsWith("project_")) {
    const idx = parseInt(blockId.split("_")[1]);
    if (!data.projects[idx]) return data;
    const next = [...data.projects];
    next[idx] = { ...next[idx], title: tf(next[idx].title), description: tf(next[idx].description), ...(next[idx].stack ? { stack: tf(next[idx].stack!) } : {}) };
    return { ...data, projects: next };
  }
  if (blockId.startsWith("education_")) {
    const idx = parseInt(blockId.split("_")[1]);
    if (!data.education[idx]) return data;
    const next = [...data.education];
    next[idx] = { ...next[idx], degree: tf(next[idx].degree), institution: tf(next[idx].institution), ...(next[idx].date ? { date: tf(next[idx].date!) } : {}) };
    return { ...data, education: next };
  }

  return data; // photo & inconnus
}

/** Liste des champs (chaînes) d'un bloc — sert à décider l'état de bascule. */
function fieldsOf(data: CVData, blockId: string): string[] {
  const collected: string[] = [];
  applyToBlock(data, blockId, (s) => { collected.push(s); return s; });
  return collected;
}

interface UseSelectionFormatArgs {
  data: CVData;
  onChange: (next: CVData) => void;
}

/** Commande de bascule → (propriété CSS, valeur). */
const TOGGLE_MAP: Record<string, [string, string]> = {
  bold: ["font-weight", "bold"],
  italic: ["font-style", "italic"],
  underline: ["text-decoration", "underline"],
  strikeThrough: ["text-decoration", "line-through"],
};

export function useSelectionFormat({ data, onChange }: UseSelectionFormatArgs) {
  /** SET : applique (et remplace) une ou plusieurs propriétés sur tout le texte
   *  des blocs sélectionnés (couleur, police, taille, titre). */
  const applyStyles = useCallback(
    (blockIds: string[], styles: Record<string, string>) => {
      const ids = [...new Set(blockIds)].filter((id) => id !== "photo");
      if (ids.length === 0) return false;
      const tf: FieldTransform = (s) => {
        if (!s) return s;
        let out = s;
        for (const [prop, value] of Object.entries(styles)) out = wrapProp(out, prop, value);
        return out;
      };
      let next = data;
      for (const id of ids) next = applyToBlock(next, id, tf);
      if (next !== data) onChange(next);
      return true;
    },
    [data, onChange]
  );

  /** TOGGLE : bascule gras/italique/souligné/barré sur tout le texte des blocs.
   *  Cible globale : si TOUS les champs portent déjà le style → on l'enlève,
   *  sinon on l'ajoute partout (état uniforme). */
  const toggleCommand = useCallback(
    (blockIds: string[], command: string) => {
      const map = TOGGLE_MAP[command];
      if (!map) return false;
      const [prop, value] = map;
      const ids = [...new Set(blockIds)].filter((id) => id !== "photo");
      if (ids.length === 0) return false;

      const allFields = ids.flatMap((id) => fieldsOf(data, id)).filter((s) => s && s.trim());
      // text-decoration : on teste la valeur précise (underline vs line-through).
      const fieldHas = (s: string) =>
        prop === "text-decoration" ? new RegExp(value, "i").test(s) : hasDecl(s, prop);
      const remove = allFields.length > 0 && allFields.every(fieldHas);

      const tf: FieldTransform = (s) => {
        if (!s) return s;
        if (remove) {
          if (prop === "text-decoration") {
            // retire seulement la valeur ciblée, garde l'autre décoration.
            return s.replace(new RegExp(`\\s*${value}`, "gi"), (m) => (m.trim() === value ? "" : m));
          }
          return stripDecl(s, prop);
        }
        return wrapProp(s, prop, value);
      };

      let next = data;
      for (const id of ids) next = applyToBlock(next, id, tf);
      if (next !== data) onChange(next);
      return true;
    },
    [data, onChange]
  );

  return { applyStyles, toggleCommand };
}
