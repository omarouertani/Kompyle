"use client";

import { useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import type { CVData } from "@/types/cv";
import { defaultLayout, removeCustomSection, getParentSectionId } from "@/lib/cv-layout";
import type { BlockPos } from "./snap";

const DUPLICABLE = /^(skill|experience|project|education)_(\d+)$/;

const SECTION_KEYS = {
  skill: "skills",
  experience: "experiences",
  project: "projects",
  education: "education",
} as const;

/**
 * Réindexe les positions manuelles d'une famille indexée (`skill_`, `experience_`…)
 * après insertion ou suppression d'un élément, en PRÉSERVANT le placement des
 * autres éléments. Avant, on purgeait toute la famille → tous les frères
 * revenaient à leur position par défaut. Les blocs sont indexés par position
 * (`experience_2`) : au retrait de l'index i, les suivants décalent de -1 ; à
 * l'insertion en i, les >= i décalent de +1 (le nouvel emplacement reste libre →
 * le bloc inséré prend sa position par défaut, sous ses frères).
 */
function reindexFamily(
  saved: Record<string, BlockPos>,
  prefix: string,
  op: { type: "delete"; index: number } | { type: "insert"; index: number },
): Record<string, BlockPos> {
  const next: Record<string, BlockPos> = {};
  const re = new RegExp(`^${prefix}_(\\d+)$`);
  for (const [k, v] of Object.entries(saved)) {
    const m = k.match(re);
    if (!m) {
      next[k] = v;
      continue;
    }
    const i = parseInt(m[1], 10);
    if (op.type === "delete") {
      if (i === op.index) continue; // l'élément supprimé
      next[`${prefix}_${i > op.index ? i - 1 : i}`] = v;
    } else {
      next[`${prefix}_${i >= op.index ? i + 1 : i}`] = v;
    }
  }
  return next;
}

interface UseBlockActionsArgs {
  data: CVData;
  defaultPositions: Record<string, BlockPos>;
  onChange: (newData: CVData) => void;
}

/** Actions sur les blocs partagées entre le menu contextuel et le clavier :
 *  hauteur auto, position par défaut, duplication, masquage de section. */
export function useBlockActions({ data, defaultPositions, onChange }: UseBlockActionsArgs) {
  const layout = useMemo(() => data.layout ?? defaultLayout(), [data.layout]);
  const saved = useMemo(() => layout.absolutePositions ?? {}, [layout.absolutePositions]);

  const updatePositions = useCallback(
    (updates: Record<string, BlockPos | undefined>) => {
      const next = { ...saved };
      for (const [id, pos] of Object.entries(updates)) {
        if (pos) next[id] = pos;
        else delete next[id];
      }
      onChange({ ...data, layout: { ...layout, absolutePositions: next } });
    },
    [data, layout, saved, onChange]
  );

  /** Supprime la hauteur explicite → le contenu reprend sa hauteur naturelle. */
  const autoHeight = useCallback(
    (ids: string[]) => {
      const updates: Record<string, BlockPos> = {};
      for (const id of ids) {
        const pos = saved[id];
        if (pos?.h) updates[id] = { ...pos, h: undefined };
      }
      if (Object.keys(updates).length) updatePositions(updates);
    },
    [saved, updatePositions]
  );

  /** Remet les blocs à leur position calculée par défaut. */
  const resetPosition = useCallback(
    (ids: string[]) => {
      const updates: Record<string, BlockPos> = {};
      for (const id of ids) {
        if (defaultPositions[id]) updates[id] = defaultPositions[id];
      }
      if (Object.keys(updates).length) updatePositions(updates);
    },
    [defaultPositions, updatePositions]
  );

  const canDuplicate = useCallback((blockId: string) => DUPLICABLE.test(blockId), []);

  /** Duplique l'élément de données (expérience, projet, compétence, formation). */
  const duplicateItem = useCallback(
    (blockId: string) => {
      const m = blockId.match(DUPLICABLE);
      if (!m) return;
      const key = SECTION_KEYS[m[1] as keyof typeof SECTION_KEYS];
      const idx = parseInt(m[2]);
      const list = data[key] as { id?: string }[];
      const item = list[idx];
      if (!item) return;
      const copy = { ...item, id: uuidv4() };
      // Insère la copie juste après l'original (index idx+1). On RÉINDEXE les
      // positions manuelles de la famille (décalage +1 pour les suivants) au lieu
      // de toutes les purger → les autres éléments gardent leur placement manuel.
      // La copie n'a pas de position sauvegardée → elle prend sa position par
      // défaut, sous ses frères.
      const nextSaved = reindexFamily(saved, m[1], { type: "insert", index: idx + 1 });
      onChange({
        ...data,
        [key]: [...list.slice(0, idx + 1), copy, ...list.slice(idx + 1)],
        layout: { ...layout, absolutePositions: nextSaved },
      });
    },
    [data, layout, saved, onChange]
  );

  /** Colle (duplique) plusieurs éléments en une seule modification. Chaque copie
   *  est insérée juste après son original et placée à sa position décalée de
   *  `offset` pt (x et y). Renvoie les ids des copies (pour les sélectionner). */
  const pasteItems = useCallback(
    (blockIds: string[], offset = 12): string[] => {
      // Regroupe les index copiés par famille (skill, experience…).
      const byFamily = new Map<string, number[]>();
      for (const id of blockIds) {
        const m = id.match(DUPLICABLE);
        if (!m) continue;
        const list = byFamily.get(m[1]) ?? [];
        const idx = parseInt(m[2]);
        if (!list.includes(idx)) list.push(idx);
        byFamily.set(m[1], list);
      }
      if (byFamily.size === 0) return [];

      const next: CVData = { ...data };
      let nextSaved = saved;
      const pastedIds: string[] = [];
      for (const [family, indexes] of byFamily) {
        const key = SECTION_KEYS[family as keyof typeof SECTION_KEYS];
        let list = [...((next[key] as { id?: string }[]) ?? [])];
        const asc = indexes.filter((i) => i >= 0 && i < list.length).sort((a, b) => a - b);
        // Ordre DÉCROISSANT : une insertion en i+1 ne décale pas les index < i,
        // donc les originaux restant à traiter gardent leur index et leur position.
        for (const idx of [...asc].reverse()) {
          const src = nextSaved[`${family}_${idx}`] ?? defaultPositions[`${family}_${idx}`];
          list = [...list.slice(0, idx + 1), { ...list[idx], id: uuidv4() }, ...list.slice(idx + 1)];
          nextSaved = reindexFamily(nextSaved, family, { type: "insert", index: idx + 1 });
          if (src) {
            nextSaved = {
              ...nextSaved,
              [`${family}_${idx + 1}`]: { ...src, x: src.x + offset, y: src.y + offset, locked: undefined, groupId: undefined },
            };
          }
        }
        (next as unknown as Record<string, unknown>)[key] = list;
        // Index final de la copie du k-ième original (ordre croissant) = i_k + k.
        asc.forEach((idx, k) => pastedIds.push(`${family}_${idx + k + 1}`));
      }
      onChange({ ...next, layout: { ...layout, autoPaginated: false, absolutePositions: nextSaved } });
      return pastedIds;
    },
    [data, layout, saved, defaultPositions, onChange]
  );

  /** Un bloc représente-t-il un ÉLÉMENT supprimable individuellement (sans
   *  toucher au reste de sa section) ? */
  const canDeleteBlock = useCallback((blockId: string) => {
    if (DUPLICABLE.test(blockId)) return true; // skill/experience/project/education item
    return [
      "content_summary",
      "content_certifications",
      "content_interests",
      "content_languages",
      "techLine",
      "photo",
    ].includes(blockId);
  }, []);

  /** Supprime UNIQUEMENT l'élément sélectionné (l'item de liste, ou le contenu
   *  d'un bloc optionnel) — jamais la section entière. La donnée disparaît donc
   *  aussi de l'export PDF et de l'envoi IA (tout reste synchronisé). */
  const deleteBlock = useCallback(
    (blockId: string) => {
      const m = blockId.match(DUPLICABLE);
      if (m) {
        const key = SECTION_KEYS[m[1] as keyof typeof SECTION_KEYS];
        const idx = parseInt(m[2]);
        const list = data[key] as { id?: string }[];
        if (!list || idx < 0 || idx >= list.length) return;
        const nextList = list.filter((_, i) => i !== idx);
        // Les positions sont indexées par position (`experience_2`…) : au retrait
        // de l'index idx, on RÉINDEXE (décalage -1 des suivants) au lieu de purger
        // toute la famille → les autres éléments gardent leur placement manuel.
        const nextSaved = reindexFamily(saved, m[1], { type: "delete", index: idx });
        onChange({ ...data, [key]: nextList, layout: { ...layout, absolutePositions: nextSaved } });
        return;
      }
      const pi = data.personalInfo;
      switch (blockId) {
        case "content_summary":
          onChange({ ...data, personalInfo: { ...pi, summary: "" } });
          return;
        case "content_certifications":
          onChange({ ...data, personalInfo: { ...pi, certifications: undefined } });
          return;
        case "content_interests":
          onChange({ ...data, personalInfo: { ...pi, interests: undefined } });
          return;
        case "techLine":
          onChange({ ...data, personalInfo: { ...pi, techLine: "" } });
          return;
        case "photo":
          onChange({ ...data, personalInfo: { ...pi, photo: undefined } });
          return;
        case "content_languages":
          onChange({ ...data, spokenLanguages: [] });
          return;
      }
    },
    [data, layout, saved, onChange]
  );

  /** Masque la section parente d'un bloc (suppression définitive si custom). */
  const hideSectionOf = useCallback(
    (blockId: string) => {
      const sectionId = getParentSectionId(blockId);
      if (sectionId.startsWith("custom_")) {
        onChange(removeCustomSection(data, sectionId));
        return;
      }
      const pages = layout.pages.map((p) => ({
        main: p.main.filter((s) => s !== sectionId),
        sidebar: p.sidebar.filter((s) => s !== sectionId),
      }));
      onChange({ ...data, layout: { ...layout, pages } });
    },
    [data, layout, onChange]
  );

  return { autoHeight, resetPosition, canDuplicate, duplicateItem, pasteItems, canDeleteBlock, deleteBlock, hideSectionOf };
}
