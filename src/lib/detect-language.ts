/**
 * Détection FR/EN de la langue d'une offre d'emploi — SOURCE UNIQUE partagée par
 * le client (redirection de locale après adaptation) et le serveur (alignement
 * des titres de section sur la langue de l'offre). Ces deux décisions doivent
 * concorder : deux heuristiques distinctes pouvaient se contredire (UI en
 * français mais titres de section en anglais, ou l'inverse).
 *
 * Comptage par mots-outils distinctifs, tokenisation simple, déterministe (aucun
 * appel réseau). Défaut "fr" en cas d'égalité (public francophone de l'app).
 */
const FR_WORDS = [
  "le", "la", "les", "des", "une", "un", "vous", "nous", "pour", "avec", "dans",
  "votre", "notre", "compétences", "expérience", "poste", "entreprise", "équipe",
  "missions", "profil", "et", "ou", "au", "aux", "du", "de", "en", "sur", "par", "plus", "est",
];
const EN_WORDS = [
  "the", "and", "or", "for", "with", "you", "we", "your", "our", "skills",
  "experience", "role", "team", "company", "requirements", "responsibilities",
  "must", "ability", "will", "of", "to", "in", "a", "on", "at", "by", "is", "more",
];

const FR_SET = new Set(FR_WORDS);
const EN_SET = new Set(EN_WORDS);

export function detectJobLanguage(text: string): "en" | "fr" {
  const words = text.toLowerCase().match(/[a-zàâäéèêëïîôöùûüç]+/g) ?? [];
  let fr = 0;
  let en = 0;
  for (const w of words) {
    if (FR_SET.has(w)) fr++;
    if (EN_SET.has(w)) en++;
  }
  return en > fr ? "en" : "fr";
}
