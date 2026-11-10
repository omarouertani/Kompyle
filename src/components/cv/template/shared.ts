import type { BlockTextAlign, CVData } from "@/types/cv";
import type { PageDims } from "@/lib/page-size";
import { stripHtml } from "@/utils/strip-html";

/** Titre d'une section dans le PDF : renommage utilisateur sinon libellé par défaut.
 *  Partagé par tous les templates PDF. */
export const sectionTitle = (data: CVData, id: string, fallback: string): string =>
  data.layout?.sectionTitles?.[id] ?? fallback;

/** Un bloc positionné hors de la page (A4 ou Letter) est ignoré au rendu PDF
 *  (sinon page blanche / boucle de pagination). Le canvas signale la limite. */
export const isBlockOutOfPage = (pos: { x: number; y: number }, page: PageDims): boolean =>
  pos.y >= page.heightPt || pos.x >= page.widthPt;

/** Métadonnées du PDF (propriétés du document : titre, auteur, mots-clés,
 *  langue), lues par les lecteurs PDF, les moteurs de recherche et certains ATS. */
export function pdfMetadata(data: CVData, locale?: string) {
  const name = stripHtml(data.personalInfo?.name ?? "").trim();
  const role = stripHtml(data.personalInfo?.role ?? "").trim();
  const skills = (data.skills ?? [])
    .flatMap((s) => stripHtml(s.items ?? "").split(/[,;•|]/))
    .map((s) => s.trim())
    .filter(Boolean);
  const keywords = [...new Set([role, ...skills].filter(Boolean))].slice(0, 30).join(", ");
  return {
    title: [name, role].filter(Boolean).join(" — ") || "CV",
    author: name || undefined,
    subject: role ? `CV — ${role}` : "CV",
    keywords: keywords || undefined,
    creator: "Kompyle",
    producer: "Kompyle",
    language: locale,
  };
}

/** Alignement de texte choisi pour un bloc (toolbar) — à poser sur la View qui
 *  positionne le bloc : react-pdf propage `textAlign` de la View aux <Text>.
 *  Accepte aussi les positions par défaut, qui n'ont pas de champ `align`. */
export const blockTextAlign = (pos: { align?: BlockTextAlign } | object): BlockTextAlign | undefined =>
  "align" in pos ? pos.align : undefined;
