import type { CVData, Experience } from "@/types/cv";

/**
 * Calcule la durée totale d'expérience (en années) à partir des champs `date`
 * des expériences. On le fait en TypeScript et on l'IMPOSE à l'IA pour éviter
 * qu'elle hallucine ce nombre (LLMs sont mauvais pour les calculs de durées).
 *
 * Les périodes au format "Start - End" sont additionnées ; "Present" /
 * "Aujourd'hui" est interprété comme la date du jour. Les dates non parsables
 * sont ignorées silencieusement.
 */
export function calculateTotalExperience(experiences: Pick<Experience, "date">[]): number {
  if (!experiences || experiences.length === 0) return 0;

  let totalMonths = 0;
  experiences.forEach((exp) => {
    try {
      const parts = (exp.date ?? "").split(" - ");
      if (parts.length !== 2) return;

      const start = new Date(parts[0]);
      const endStr = parts[1].trim();
      const end =
        endStr.toLowerCase() === "present" || endStr.toLowerCase() === "aujourd'hui"
          ? new Date()
          : new Date(endStr);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        totalMonths += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      }
    } catch {
      // formats non parsables : on ignore
    }
  });

  return Math.round((totalMonths / 12) * 10) / 10;
}

/** Helper de convenance — accepte directement un CVData. */
export function totalYearsOfExperience(cv: CVData): number {
  return calculateTotalExperience(cv.experiences ?? []);
}
