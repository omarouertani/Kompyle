import { parseMonthYear, isPresentToken, splitDateRange } from "./cv-analysis";

/**
 * Modèle structuré d'une période d'expérience, manipulé par le sélecteur
 * mois/année. Le CV stocke toujours la date sous forme de CHAÎNE (rendue telle
 * quelle par les templates et le PDF) ; ce module fait le pont entre cette chaîne
 * et l'état du picker :
 *   - `parseExperienceDate` : chaîne → {start, end, current} (pré-remplissage)
 *   - `formatExperienceDate` : {start, end, current} → chaîne canonique
 *
 * Règles d'affichage :
 *   - période fermée  → "Mois Année - Mois Année"
 *   - poste en cours  → "Mois Année" (date d'entrée uniquement)
 */

export interface MonthYear {
  year: number;
  month: number; // 0-based (0 = janvier)
}

export interface ExperienceDateValue {
  start: MonthYear | null;
  /** Fin de période. Ignorée quand `current` est vrai. */
  end: MonthYear | null;
  /** L'utilisateur occupe toujours ce poste → on n'affiche que la date d'entrée. */
  current: boolean;
}

export const EMPTY_DATE_VALUE: ExperienceDateValue = { start: null, end: null, current: false };

/** Parse une chaîne de date libre/canonique vers le modèle du picker. */
export function parseExperienceDate(str: string | undefined | null): ExperienceDateValue {
  if (!str || !str.trim()) return { ...EMPTY_DATE_VALUE };

  const parts = splitDateRange(str);
  if (parts.length === 0) return { ...EMPTY_DATE_VALUE };

  const start = parseMonthYear(parts[0]);

  // Un seul fragment : soit "Present" seul (rare), soit une date d'entrée unique.
  // Date seule = période OUVERTE mais PAS "poste actuel" (sinon décocher « poste
  // actuel » reproduirait une date seule → re-parsée comme courante → bascule
  // bloquée). Le statut "en cours" n'est vrai QUE via un token explicite.
  if (parts.length < 2) {
    if (parts[0] && isPresentToken(parts[0])) return { start: null, end: null, current: true };
    return { start, end: null, current: false };
  }

  const endToken = parts[parts.length - 1];
  if (isPresentToken(endToken)) return { start, end: null, current: true };

  return { start, end: parseMonthYear(endToken), current: false };
}

/**
 * Formate un modèle de période vers sa chaîne canonique.
 * @param monthName  fonction de libellé de mois (locale-aware, ex. via Intl)
 * @param presentLabel  libellé "en cours" (inutilisé : un poste courant n'affiche
 *   que la date d'entrée, mais on le garde pour d'éventuels formats alternatifs)
 */
export function formatExperienceDate(
  value: ExperienceDateValue,
  monthName: (month: number) => string,
  presentLabel = "Present",
): string {
  if (!value.start) return "";
  const startLabel = `${monthName(value.start.month)} ${value.start.year}`;

  // Poste en cours → token EXPLICITE ("Start - Present") pour que l'aller-retour
  // chaîne↔modèle conserve l'état (et que décocher ne reste pas bloqué).
  if (value.current) return `${startLabel} - ${presentLabel}`;
  if (!value.end) return startLabel;

  return `${startLabel} - ${monthName(value.end.month)} ${value.end.year}`;
}
