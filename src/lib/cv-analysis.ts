import type { CVData, Experience } from "@/types/cv";

/**
 * Calcul des durées d'expérience — fait en TypeScript puis IMPOSÉ à l'IA pour
 * éviter qu'elle hallucine ces nombres (les LLMs sont mauvais en arithmétique
 * de dates).
 *
 * Le champ `date` d'une expérience est du texte libre saisi par l'utilisateur.
 * On supporte donc une large variété de formats réels :
 *   "Sept. 2024 – May. 2026", "Janvier 2020 - Décembre 2021",
 *   "09/2024 - 05/2026", "2020 – Present", "Jan 2019 to Aujourd'hui"…
 * Séparateurs gérés : tiret, tiret demi-cadratin (–), cadratin (—), "to",
 * "au", "à". Fin ouverte ("Present", "Aujourd'hui", "En cours"…) = mois courant.
 */

// ─── Dictionnaire de mois (FR + EN, complets + abréviations) ─────────────────
// Les clés sont normalisées (sans accent, sans point, minuscules).
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, janvier: 0, janv: 0,
  feb: 1, february: 1, fevrier: 1, fevr: 1, fev: 1,
  mar: 2, march: 2, mars: 2,
  apr: 3, april: 3, avril: 3, avr: 3,
  may: 4, mai: 4,
  jun: 5, june: 5, juin: 5,
  jul: 6, july: 6, juillet: 6, juil: 6,
  aug: 7, august: 7, aout: 7, ao: 7,
  sep: 8, sept: 8, september: 8, septembre: 8,
  oct: 9, october: 9, octobre: 9,
  nov: 10, november: 10, novembre: 10,
  dec: 11, december: 11, decembre: 11,
};

// Mots signalant une période en cours → on borne la fin au mois courant.
const PRESENT_RE =
  /\b(present|now|current|currently|today|ongoing|actuel|actuelle|aujourd\s?hui|en\s?cours|depuis|a\s?ce\s?jour)\b/;

// Plage des diacritiques combinants U+0300–U+036F (construite par code-point
// pour éviter d'embarquer des caractères combinants littéraux dans la source).
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g",
);

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "");
}

function normalize(s: string): string {
  return stripAccents(s).toLowerCase().replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

export interface YM {
  year: number;
  month: number; // 0-based
}

/** True si le fragment dénote une période en cours ("Present", "Aujourd'hui"…). */
export function isPresentToken(token: string): boolean {
  return PRESENT_RE.test(normalize(token));
}

/** Découpe une plage "début – fin" sur les séparateurs courants (–, —, -, to, au, à). */
export function splitDateRange(dateStr: string): string[] {
  return dateStr
    .split(/\s*[–—]\s*|\s+-\s+|\s+(?:to|au|a|à|jusqu['\s]?au?)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Convertit un fragment ("Sept. 2024", "09/2024", "2024") en {year, month}. */
export function parseMonthYear(token: string): YM | null {
  const norm = normalize(token);
  if (!norm) return null;

  const yearMatch = norm.match(/(19|20)\d{2}/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[0], 10);

  let month: number | null = null;

  // Formats numériques : "09/2024", "2024-09", "09.2024"…
  const numAfter = norm.match(/\b(\d{1,2})[\s/\-]+(?:19|20)\d{2}\b/);
  const numBefore = norm.match(/\b(?:19|20)\d{2}[\s/\-]+(\d{1,2})\b/);
  if (numAfter) {
    const m = parseInt(numAfter[1], 10);
    if (m >= 1 && m <= 12) month = m - 1;
  } else if (numBefore) {
    const m = parseInt(numBefore[1], 10);
    if (m >= 1 && m <= 12) month = m - 1;
  }

  // Noms de mois (FR/EN). Correspondance exacte puis par préfixe (plus longue gagne).
  if (month === null) {
    const words = norm.match(/[a-z]+/g) ?? [];
    for (const w of words) {
      if (MONTHS[w] !== undefined) {
        month = MONTHS[w];
        break;
      }
    }
    if (month === null) {
      let best = "";
      for (const w of words) {
        for (const key of Object.keys(MONTHS)) {
          if (w.startsWith(key) && key.length > best.length) {
            best = key;
            month = MONTHS[key];
          }
        }
      }
    }
  }

  // Année seule, sans mois ("2020 - 2024") → on suppose janvier.
  return { year, month: month ?? 0 };
}

/**
 * Durée d'une période en mois (entier, ≥ 0). `null` si non parsable.
 * Compte exclusif : (fin.année*12 + fin.mois) − (début.année*12 + début.mois).
 * Ex. "Sept. 2024 – May. 2026" = 20 mois = 1 an 8 mois.
 */
export function parseDurationMonths(dateStr: string | undefined | null): number | null {
  if (!dateStr || !dateStr.trim()) return null;

  // Découpe sur les séparateurs de plage (tirets entourés d'espaces, –, —, "to", "au", "à").
  const parts = splitDateRange(dateStr);

  if (parts.length < 1) return null;

  const start = parseMonthYear(parts[0]);
  if (!start) return null;

  const endToken = parts.length >= 2 ? parts[parts.length - 1] : "";
  let end: YM | null;
  if (!endToken || isPresentToken(endToken)) {
    const now = new Date();
    end = { year: now.getFullYear(), month: now.getMonth() };
  } else {
    end = parseMonthYear(endToken);
    // Fin non parsable mais début OK → période en cours.
    if (!end) {
      const now = new Date();
      end = { year: now.getFullYear(), month: now.getMonth() };
    }
  }

  const months = end.year * 12 + end.month - (start.year * 12 + start.month);
  return months > 0 ? months : 0;
}

/** Formate un nombre de mois en libellé canonique anglais ("2 years 8 months"). */
export function formatDuration(months: number): string {
  if (months <= 0) return "less than 1 month";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (rem > 0) parts.push(`${rem} month${rem > 1 ? "s" : ""}`);
  return parts.join(" ");
}

export interface ExperienceDuration {
  date: string;
  months: number | null;
  label: string;
}

export interface ExperienceSummary {
  perExperience: ExperienceDuration[];
  totalMonths: number;
  totalYears: number;
  totalLabel: string;
}

/** Détail par expérience + total, pour injection dans le prompt IA. */
export function summarizeExperience(experiences: Pick<Experience, "date">[]): ExperienceSummary {
  const perExperience: ExperienceDuration[] = (experiences ?? []).map((exp) => {
    const months = parseDurationMonths(exp.date);
    return {
      date: exp.date ?? "",
      months,
      label: months === null ? "(duration not computable)" : formatDuration(months),
    };
  });

  const totalMonths = perExperience.reduce((sum, e) => sum + (e.months ?? 0), 0);

  return {
    perExperience,
    totalMonths,
    totalYears: Math.round((totalMonths / 12) * 10) / 10,
    totalLabel: formatDuration(totalMonths),
  };
}

/**
 * Bloc texte prêt à injecter dans un prompt : total + durée par poste.
 * L'IA s'en sert pour comparer l'expérience réelle aux exigences de l'offre.
 */
export function describeExperienceForPrompt(experiences: Pick<Experience, "date">[]): string {
  const { perExperience, totalMonths, totalYears, totalLabel } = summarizeExperience(experiences);
  const lines = perExperience
    .filter((e) => e.date)
    .map((e) => `  • "${e.date}" → ${e.label}`)
    .join("\n");
  return `- Total Professional Experience: EXACTLY ${totalLabel} (${totalYears} years / ${totalMonths} months total).
- Per-role durations (computed, DO NOT recalculate):
${lines || "  • (no dated experience found)"}`;
}

/**
 * Durée totale d'expérience (en années décimales). Conservé pour compat.
 */
export function calculateTotalExperience(experiences: Pick<Experience, "date">[]): number {
  return summarizeExperience(experiences).totalYears;
}

/** Helper de convenance — accepte directement un CVData. */
export function totalYearsOfExperience(cv: CVData): number {
  return calculateTotalExperience(cv.experiences ?? []);
}
