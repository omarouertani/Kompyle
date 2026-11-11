import type { ElementPosition } from "@/types/cv";
import { isFreeElementId } from "./free-elements";

/** Actions d'ordre de superposition (menu contextuel, panneau de calques). */
export type ZAction = "front" | "forward" | "backward" | "back";

type PosLike = Partial<Pick<ElementPosition, "z" | "hidden">> | undefined;

/** Rang par défaut : sections et en-tête à 0, éléments libres à 1 (ils passent
 *  au-dessus des sections, comme avant l'ordre de superposition). */
const defaultZ = (id: string): number => (isFreeElementId(id) ? 1 : 0);

export const effectiveZ = (id: string, pos: PosLike): number => pos?.z ?? defaultZ(id);

/**
 * Ids triés du fond vers l'avant. Tri stable : à rang égal, l'ordre d'entrée
 * est gardé (en-tête, colonne latérale, colonne principale, éléments libres),
 * qui est l'ordre historique du canvas et du PDF.
 */
export function sortByZ(ids: string[], getPos: (id: string) => PosLike): string[] {
  return ids
    .map((id, i) => ({ id, i, z: effectiveZ(id, getPos(id)) }))
    .sort((a, b) => a.z - b.z || a.i - b.i)
    .map((x) => x.id);
}

/**
 * Nouvel ordre (du fond vers l'avant) après avoir appliqué `action` aux ids
 * `targets`. Avancer / reculer déplace chaque cible d'un cran ; des cibles
 * voisines bougent ensemble.
 */
export function reorderStack(stack: string[], targets: string[], action: ZAction): string[] {
  const sel = new Set(targets);
  if (!stack.some((id) => sel.has(id))) return stack;
  const moving = stack.filter((id) => sel.has(id));
  const rest = stack.filter((id) => !sel.has(id));
  if (action === "front") return [...rest, ...moving];
  if (action === "back") return [...moving, ...rest];
  const out = [...stack];
  if (action === "forward") {
    for (let i = out.length - 2; i >= 0; i--) {
      if (sel.has(out[i]) && !sel.has(out[i + 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
    }
  } else {
    for (let i = 1; i < out.length; i++) {
      if (sel.has(out[i]) && !sel.has(out[i - 1])) [out[i], out[i - 1]] = [out[i - 1], out[i]];
    }
  }
  return out;
}

/** Déplace `id` à l'index `to` d'une pile (glisser-déposer du panneau). */
export function moveInStack(stack: string[], id: string, to: number): string[] {
  const from = stack.indexOf(id);
  if (from < 0) return stack;
  const out = stack.filter((x) => x !== id);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, id);
  return out;
}

/**
 * Écrit l'ordre d'une pile dans les positions (`z` = index dans la pile).
 * `resolve` fournit la position courante d'un id absent de `positions`
 * (positions par défaut, position de création d'un élément libre).
 */
export function writeStackZ(
  positions: Record<string, ElementPosition>,
  stack: string[],
  resolve: (id: string) => ElementPosition | undefined,
): Record<string, ElementPosition> {
  const out = { ...positions };
  stack.forEach((id, z) => {
    const pos = out[id] ?? resolve(id);
    if (pos) out[id] = { ...pos, z };
  });
  return out;
}
