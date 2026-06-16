"use client";

import { useState, useEffect, useCallback } from "react";
import type { CVData, CVLayout } from "@/types/cv";
import { emptyLayoutPage } from "@/lib/cv-layout";

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
   *  sinon la page active. */
  const removePage = useCallback(
    (pageIndex?: number) => {
      if (layout.pages.length <= 1) return;
      const idx = pageIndex ?? activePageIndex;
      if (idx < 0 || idx >= layout.pages.length) return;
      const nextPages = layout.pages.filter((_, i) => i !== idx);
      onChange({ ...data, layout: { ...layout, pages: nextPages } });
      setActivePageIndex(Math.min(idx, nextPages.length - 1));
    },
    [layout, data, onChange, activePageIndex]
  );

  return { activePageIndex, setActivePageIndex, addPage, removePage };
}
