"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import type { CVData, CVLayout, CVTheme } from "@/types/cv";
import {
  getSectionBlockIds,
  computePaginatedFlow,
  getColumnSections,
} from "@/lib/cv-layout";
import { PT_TO_PX, A4_HEIGHT_PX } from "../cv-canvas-primitives";
import type { BlockPos } from "./snap";

interface UseCanvasPaginationArgs {
  data: CVData;
  layout: CVLayout;
  template: string;
  onChange: (newData: CVData) => void;
  onOverflowChange?: (isOverflowing: boolean) => void;
  /** Positions résolues (défaut + sauvegardées) — sert au calcul du débordement. */
  absolutePositions: Record<string, BlockPos>;
}

/** Mesure des hauteurs, reflow paginé mesuré, auto-pagination, détection de
 *  débordement et mise à jour de thème avec reflow.
 *
 *  Le cœur du module : tout ce qui répartit les blocs sur des pages A4 à partir
 *  de leurs hauteurs RÉELLES (mesurées dans le DOM, après chargement des
 *  polices) plutôt que d'estimations heuristiques. */
export function useCanvasPagination({
  data,
  layout,
  template,
  onChange,
  onOverflowChange,
  absolutePositions,
}: UseCanvasPaginationArgs) {
  // Mesure la hauteur réelle d'un bloc rendu (offsetHeight est pré-scale).
  const measureHeightPt = useCallback((blockId: string): number | null => {
    const el = document.querySelector(`[data-block-id="${blockId}"]`) as HTMLElement | null;
    return el ? el.offsetHeight / PT_TO_PX : null;
  }, []);

  // Construit un layout paginé : positions reflowées + blocs répartis sur
  // autant de pages que nécessaire (aucun bloc ne dépasse la hauteur A4).
  const buildPaginatedLayout = useCallback(
    (d: CVData, l: CVLayout, tpl: string): CVLayout | null => {
      const { positions, pageCount } = computePaginatedFlow(tpl, d, measureHeightPt);
      if (Object.keys(positions).length === 0) return null;
      const cols = getColumnSections(l);
      const pages = Array.from({ length: pageCount }, (_, p) => ({
        sidebar: cols.sidebar.filter((s) =>
          getSectionBlockIds(s, d).some((b) => (positions[b]?.page ?? 0) === p)
        ),
        main: cols.main.filter((s) =>
          getSectionBlockIds(s, d).some((b) => (positions[b]?.page ?? 0) === p)
        ),
      }));
      return { ...l, useAbsolutePositioning: true, autoPaginated: true, absolutePositions: positions, pages };
    },
    [measureHeightPt]
  );

  // Snapshots pour les effets d'auto-reflow : on lit les dernières valeurs via
  // des refs au lieu de les mettre en dépendances — sinon l'effet se redéclenche
  // à CHAQUE render (data/layout changent d'identité), provoquant une boucle qui
  // fige l'app.
  const reflowRefs = useRef({ data, layout, template, onChange });
  // eslint-disable-next-line react-hooks/refs -- mise à jour intentionnelle : capture les dernières valeurs pour les callbacks rAF (lecture hors rendu)
  reflowRefs.current = { data, layout, template, onChange };

  // Y a-t-il des positions sauvegardées ? (dépendance PRIMITIVE de l'effet)
  const hasSavedPositions = !!(layout.absolutePositions && Object.keys(layout.absolutePositions).length > 0);

  // DIAGNOSTIC : casse une éventuelle boucle de reflow et la signale.
  const reflowCount = useRef(0);

  // Auto-reflow mesuré : un CV SANS positions sauvegardées (nouveau, ou
  // fraîchement adapté/raffiné — l'API strippe alors absolutePositions) est
  // mis en page à partir des hauteurs RÉELLES des blocs, après chargement des
  // polices. Élimine les chevauchements dus aux estimations heuristiques quand
  // le contenu change de longueur. L'effet ne se déclenche QUE lorsque
  // `hasSavedPositions` passe à false → exécution unique, jamais en boucle.
  useEffect(() => {
    if (hasSavedPositions) { reflowCount.current = 0; return; }
    if (reflowCount.current > 10) { console.error("[Kompyle] REFLOW LOOP DETECTED — positions re-stripped after write"); return; }
    reflowCount.current++;

    let cancelled = false;
    const apply = () => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const { data: d, layout: l, template: tpl, onChange: oc } = reflowRefs.current;
        const nextLayout = buildPaginatedLayout(d, l, tpl);
        // Garde anti-boucle : ne jamais écrire un layout vide (sinon
        // hasSavedPositions resterait false et l'effet se relancerait).
        if (!nextLayout) return;
        oc({ ...d, layout: nextLayout });
      });
    };

    // Attendre les polices : leurs métriques changent la hauteur du texte.
    if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => { if (!cancelled) apply(); });
    } else {
      apply();
    }
    return () => { cancelled = true; };
  }, [hasSavedPositions, measureHeightPt, buildPaginatedLayout]);

  // « Tout réaligner » : reflow à partir des hauteurs RÉELLES mesurées dans le
  // DOM (et non des estimations), garantissant un empilement sans chevauchement.
  const realign = useCallback(() => {
    const nextLayout = buildPaginatedLayout(data, layout, template);
    if (!nextLayout) return;
    onChange({ ...data, layout: nextLayout });
  }, [data, layout, template, onChange, buildPaginatedLayout]);

  // Réalignement différé : attend que le DOM reflète le dernier onChange
  // (double rAF) avant de mesurer — utilisé après un changement de thème.
  const realignAfterRender = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const { data: d, layout: l, template: tpl, onChange: oc } = reflowRefs.current;
        const nextLayout = buildPaginatedLayout(d, l, tpl);
        if (nextLayout) oc({ ...d, layout: nextLayout });
      })
    );
  }, [buildPaginatedLayout]);

  /** Mise à jour du thème depuis la toolbar. `reflow` : les tailles/espacements
   *  ont changé → on réaligne les blocs sur leurs nouvelles hauteurs réelles. */
  const updateTheme = useCallback(
    (updates: Partial<CVTheme>, opts?: { reflow?: boolean }) => {
      const { data: d, layout: l, onChange: oc } = reflowRefs.current;
      if (Object.keys(updates).length > 0) {
        oc({ ...d, layout: { ...l, theme: { ...(l.theme ?? {}), ...updates } } });
      }
      if (opts?.reflow) realignAfterRender();
    },
    [realignAfterRender]
  );

  // Bas de contenu RÉEL (mesuré) de la page la plus chargée. En mode paginé,
  // chaque page réinitialise `y` en haut → `pos.y + hauteur` est le bas dans la
  // page ; le max sur tous les blocs = la page la plus haute. Contrairement à
  // `estimateAbsolutePageHeightPt` (qui plancher à 842 + marge, donc toujours
  // « plein »), ceci détecte un VRAI débordement de la zone A4.
  const maxContentBottomPt = useMemo(() => {
    let worst = 0;
    for (const [id, pos] of Object.entries(absolutePositions)) {
      const h = measureHeightPt(id) ?? pos.h ?? 24;
      worst = Math.max(worst, pos.y + h);
    }
    return worst;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [absolutePositions, data, measureHeightPt]);

  const isOverflowing = maxContentBottomPt * PT_TO_PX > A4_HEIGHT_PX;

  // Hauteur de page affichée : une A4 fixe en mode paginé (chaque page tient sur
  // une A4) ; sinon on laisse la page grandir pour montrer tout le contenu.
  const pageHeightPx = layout.autoPaginated
    ? A4_HEIGHT_PX
    : Math.max(A4_HEIGHT_PX, maxContentBottomPt * PT_TO_PX + 40);

  useEffect(() => {
    onOverflowChange?.(isOverflowing);
  }, [isOverflowing, onOverflowChange]);

  // Auto-pagination : dès que le contenu dépasse la hauteur d'une page A4,
  // on répartit les blocs sur une nouvelle page (mesure réelle). La garde
  // borne le nombre de tentatives — si un SEUL bloc dépasse la page (ex. une
  // expérience géante non sécable), on s'arrête au lieu de boucler.
  const paginateGuard = useRef(0);
  useEffect(() => {
    if (!isOverflowing) { paginateGuard.current = 0; return; }
    if (paginateGuard.current > 5) {
      console.warn("[Kompyle] Auto-pagination plafonnée — un bloc dépasse seul la page");
      return;
    }
    paginateGuard.current++;

    let cancelled = false;
    const run = () => requestAnimationFrame(() => {
      if (cancelled) return;
      const { data: d, layout: l, template: tpl, onChange: oc } = reflowRefs.current;
      const nextLayout = buildPaginatedLayout(d, l, tpl);
      if (nextLayout) oc({ ...d, layout: nextLayout });
    });

    if (typeof document !== "undefined" && document.fonts && document.fonts.status !== "loaded") {
      document.fonts.ready.then(() => { if (!cancelled) run(); });
    } else {
      run();
    }
    return () => { cancelled = true; };
  }, [isOverflowing, buildPaginatedLayout]);

  return { measureHeightPt, realign, realignAfterRender, updateTheme, isOverflowing, pageHeightPx };
}
