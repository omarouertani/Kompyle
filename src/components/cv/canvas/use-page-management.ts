"use client";

import { useState, useEffect, useCallback } from "react";
import type { CVData, CVLayout } from "@/types/cv";
import { emptyLayoutPage, dedupePages } from "@/lib/cv-layout";

interface UsePageManagementArgs {
  layout: CVLayout;
  data: CVData;
  onChange: (newData: CVData) => void;
}

/** Gestion des pages du CV : index actif (clampé), ajout / suppression de page,
 *  et défilement automatique vers la page active. */
export function usePageManagement({ layout, data, onChange }: UsePageManagementArgs) {
  const [rawPageIndex, setActivePageIndex] = useState(0);
  // Clampé au nombre de pages réel (évite un index orphelin après suppression)
  const activePageIndex = Math.min(rawPageIndex, layout.pages.length - 1);

  useEffect(() => {
    document.getElementById(`cv-page-${activePageIndex}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activePageIndex]);

  const addPage = useCallback(() => {
    const nextPages = [...layout.pages, emptyLayoutPage()];
    onChange({ ...data, layout: { ...layout, pages: nextPages } });
    setActivePageIndex(nextPages.length - 1);
  }, [layout, data, onChange]);

  /** Supprime une page : celle d'index `pageIndex` si fourni (menu contextuel),
   *  sinon la page active.
   *
   *  Les sections de la page supprimée sont FUSIONNÉES dans une page voisine
   *  (jamais perdues — avant, elles disparaissaient silencieusement). On repart
   *  ensuite d'un placement automatique propre (positions absolues effacées) :
   *  cela évite le chevauchement en-tête (nom/photo) ↔ contenu observé en
   *  supprimant la page 1, et laisse le canvas recalculer un empilement mesuré,
   *  exactement comme lors d'un changement de template. */
  const removePage = useCallback(
    (pageIndex?: number) => {
      if (layout.pages.length <= 1) return;
      const idx = pageIndex ?? activePageIndex;
      if (idx < 0 || idx >= layout.pages.length) return;

      const removed = layout.pages[idx];
      const survivors = layout.pages.filter((_, i) => i !== idx);
      // Page cible pour les sections orphelines : la précédente, ou (si on
      // supprime la 1re page) la nouvelle 1re page.
      const mergeInto = idx > 0 ? idx - 1 : 0;
      if (removed && survivors[mergeInto]) {
        survivors[mergeInto] = {
          main: [...survivors[mergeInto].main, ...removed.main],
          sidebar: [...survivors[mergeInto].sidebar, ...removed.sidebar],
        };
      }

      onChange({
        ...data,
        layout: {
          ...layout,
          pages: dedupePages(survivors),
          absolutePositions: undefined,
          useAbsolutePositioning: false,
          autoPaginated: false,
        },
      });
      setActivePageIndex(Math.min(idx, survivors.length - 1));
    },
    [layout, data, onChange, activePageIndex]
  );

  return { activePageIndex, setActivePageIndex, addPage, removePage };
}
