import type { ATSSectionStatus } from "@/types/cv";

export type ScoreTone = "excellent" | "good" | "warning" | "poor";

export function toneForScore(score: number): ScoreTone {
  if (score >= 85) return "excellent";
  if (score >= 65) return "good";
  if (score >= 40) return "warning";
  return "poor";
}

/** Couleur (CSS variable) utilisée par le chart radial, les barres et les badges.
 *  Pioché sur les tokens `--ats-*` définis dans globals.css : reste aligné avec
 *  le thème (violet → rouge), pas de vert/orange criards. */
export function cssVarForScore(score: number): string {
  const tone = toneForScore(score);
  if (tone === "excellent") return "var(--ats-excellent)";
  if (tone === "good") return "var(--ats-good)";
  if (tone === "warning") return "var(--ats-warning)";
  return "var(--ats-poor)";
}

export function cssVarForTone(tone: ScoreTone): string {
  if (tone === "excellent") return "var(--ats-excellent)";
  if (tone === "good") return "var(--ats-good)";
  if (tone === "warning") return "var(--ats-warning)";
  return "var(--ats-poor)";
}

/** Couleur d'un statut de section (OK / partiel / manquant). */
export function cssVarForStatus(status: ATSSectionStatus): string {
  return cssVarForTone(status === "good" ? "excellent" : status === "warning" ? "warning" : "poor");
}
