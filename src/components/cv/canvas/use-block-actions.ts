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
      // Insère la copie juste après l'original. Comme pour la suppression, les
      // positions sont indexées : on purge celles de la famille pour que la
      // section (original + copie) se re-cale proprement, au lieu que la copie
      // hérite de l'ancienne position d'un voisin (effet « bloc déplacé »).
      const nextSaved = { ...saved };
      for (const k of Object.keys(nextSaved)) {
        if (k.startsWith(`${m[1]}_`)) delete nextSaved[k];
      }
      onChange({
        ...data,
        [key]: [...list.slice(0, idx + 1), copy, ...list.slice(idx + 1)],
        layout: { ...layout, absolutePositions: nextSaved },
      });
    },
    [data, layout, saved, onChange]
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
        // Les positions sont indexées par id (`experience_2`…) : après le retrait,
        // les items suivants changent d'index. On purge les positions sauvegardées
        // de TOUTE la famille → ses items se re-calent proprement sur les défauts
        // (pas de saut sur l'ancienne position d'un voisin).
        const nextSaved = { ...saved };
        for (const k of Object.keys(nextSaved)) {
          if (k.startsWith(`${m[1]}_`)) delete nextSaved[k];
        }
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

  return { autoHeight, resetPosition, canDuplicate, duplicateItem, canDeleteBlock, deleteBlock, hideSectionOf };
}
