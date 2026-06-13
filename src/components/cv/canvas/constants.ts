/** Constantes partagées du canvas interactif. */

/** Profondeur maximale de la pile d'annulation (undo). */
export const HISTORY_LIMIT = 30;

/** Fenêtre de coalescence des snapshots d'historique (sliders, reflows) :
 *  des mutations rapprochées (<400 ms) ne comptent que pour un seul pas d'undo. */
export const HISTORY_COALESCE_MS = 400;
