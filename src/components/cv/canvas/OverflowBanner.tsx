"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, FilePlus, FoldVertical } from "lucide-react";

interface OverflowBannerProps {
  canTighten: boolean;
  onTighten: () => void;
  onAddPage: () => void;
}

/** Bannière affichée quand le contenu dépasse la page : propose de réduire
 *  l'espacement ou de répartir le contenu sur une page de plus. Le
 *  téléchargement reste possible (bouton « Télécharger quand même »). */
export function OverflowBanner({ canTighten, onTighten, onAddPage }: OverflowBannerProps) {
  const t = useTranslations("Canvas");
  const btn =
    "h-7 px-2.5 inline-flex items-center gap-1.5 rounded-md text-xs font-medium border border-amber-500/30 bg-background/80 hover:bg-background transition-colors disabled:opacity-40 disabled:pointer-events-none";
  return (
    <div
      role="status"
      className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
    >
      <AlertTriangle size={14} className="shrink-0" />
      <span className="font-medium mr-auto">{t("overflow_banner")}</span>
      <button type="button" className={btn} onClick={onTighten} disabled={!canTighten}>
        <FoldVertical size={13} />
        {t("overflow_tighten")}
      </button>
      <button type="button" className={btn} onClick={onAddPage}>
        <FilePlus size={13} />
        {t("overflow_add_page")}
      </button>
    </div>
  );
}
