/** D2 — éditeur TipTap des champs du canvas (essai). Activé par la variable
 *  `NEXT_PUBLIC_TIPTAP_EDITOR=1` ou, sans redémarrer, par
 *  `localStorage["kompyle.tiptap"] = "1"`. Lu au focus d'un champ seulement
 *  (jamais pendant le rendu → pas d'écart d'hydratation). */
export function isTiptapEditorEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_TIPTAP_EDITOR === "1") return true;
  try {
    return window.localStorage.getItem("kompyle.tiptap") === "1";
  } catch {
    return false;
  }
}
