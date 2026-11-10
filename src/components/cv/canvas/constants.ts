/** Constantes partagées du canvas interactif. */

/** Profondeur maximale de la pile d'annulation (undo). */
export const HISTORY_LIMIT = 30;

/** Fenêtre de coalescence des snapshots d'historique (sliders, reflows) :
 *  des mutations rapprochées (<400 ms) ne comptent que pour un seul pas d'undo. */
export const HISTORY_COALESCE_MS = 400;
/** Frappe dans un éditeur : commit (= un pas d'historique) après ce délai
 *  d'inactivité, en plus du commit au blur. */
export const TYPING_COMMIT_IDLE_MS = 800;
