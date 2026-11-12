import type { CVData } from "@/types/cv";

/**
 * Changements EXTERNES au canvas qui doivent rester annulables par Ctrl+Z.
 *
 * Le canvas n'enregistre dans sa pile d'annulation que ses propres mutations ;
 * un CV remplacé de l'extérieur (changement de profil, adaptation IA) n'y entre
 * pas — à raison pour un changement de profil. Un appelant qui remplace le CV
 * et veut que Ctrl+Z le défasse (import d'un CV) marque la nouvelle valeur ici :
 * le canvas empile alors l'état précédent comme UN pas d'annulation.
 */
const undoable = new WeakSet<CVData>();

export function markUndoableChange(next: CVData): CVData {
  undoable.add(next);
  return next;
}

export function isUndoableChange(next: CVData): boolean {
  return undoable.has(next);
}
