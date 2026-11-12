import type { SkillGroup } from "@/types/cv";

/**
 * Niveau des compétences affichées en barres (modèles « barres », ex. Créatif).
 *
 * Stocké par groupe dans `SkillGroup.levels`, indexé par le libellé de la
 * compétence (insensible à la casse et aux espaces) : un réordonnancement ou
 * l'ajout d'une compétence ne décale pas les niveaux. Une compétence sans
 * niveau garde l'affichage historique (barre aux 3/4).
 */

export const SKILL_LEVEL_MAX = 5;
/** Remplissage d'une compétence sans niveau choisi (rendu historique). */
const DEFAULT_FILL = 0.75;

/** Clé normalisée d'une compétence (le texte peut porter du HTML inline). */
export function skillKey(item: string): string {
  return item.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function clampLevel(level: number): number {
  return Math.min(SKILL_LEVEL_MAX, Math.max(1, Math.round(level)));
}

/** Niveau choisi (1-5) ou `undefined` si aucun. */
export function getSkillLevel(group: SkillGroup, item: string): number | undefined {
  const v = group.levels?.[skillKey(item)];
  return typeof v === "number" && Number.isFinite(v) ? clampLevel(v) : undefined;
}

/** Remplissage de la barre (0-1), commun au canvas et au PDF. */
export function skillFill(group: SkillGroup, item: string): number {
  const level = getSkillLevel(group, item);
  return level === undefined ? DEFAULT_FILL : level / SKILL_LEVEL_MAX;
}

/** Fixe le niveau d'une compétence. */
export function setSkillLevel(group: SkillGroup, item: string, level: number): SkillGroup {
  return { ...group, levels: { ...group.levels, [skillKey(item)]: clampLevel(level) } };
}

/** Renommage d'une compétence : son niveau la suit. */
export function renameSkillLevel(group: SkillGroup, from: string, to: string): SkillGroup {
  const fromKey = skillKey(from);
  const toKey = skillKey(to);
  if (!group.levels || fromKey === toKey || group.levels[fromKey] === undefined) return group;
  const { [fromKey]: level, ...rest } = group.levels;
  return { ...group, levels: { ...rest, [toKey]: level } };
}

/**
 * Ré-impose après une réponse de l'IA (adaptation / raffinement) les niveaux
 * choisis par l'utilisateur : l'IA ne les gère pas. Groupe retrouvé par id,
 * sinon par position ; niveau gardé pour chaque compétence encore présente.
 */
export function carrySkillLevels(next: SkillGroup[], prev: SkillGroup[]): SkillGroup[] {
  return next.map((group, i) => {
    const source = prev.find((p) => p.id && p.id === group.id) ?? prev[i];
    const rest: SkillGroup = { ...group };
    delete rest.levels;
    if (!source?.levels) return rest;
    const items = group.items.split(",").map(skillKey).filter(Boolean);
    const levels: Record<string, number> = {};
    for (const key of items) {
      if (source.levels[key] !== undefined) levels[key] = source.levels[key];
    }
    return Object.keys(levels).length ? { ...rest, levels } : rest;
  });
}
