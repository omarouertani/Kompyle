"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import type { CVData, CVLayout, CVTheme } from "@/types/cv";
import {
  getSectionBlockIds,
  computePaginatedFlow,
  computeDefaultPositions,
  getColumnSections,
  getParentSectionId,
  isModernTemplate,
} from "@/lib/cv-layout";
import { PT_TO_PX, A4_HEIGHT_PX } from "../cv-canvas-primitives";
import type { BlockPos } from "./snap";

// ─── Auto-ajustement « tenir sur une page » ──────────────────────────────────
// Bornes de lisibilité : on ne réduit jamais en deçà de ces seuils, même si le
// contenu ne tient pas — on bascule alors sur une 2ᵉ page.
const FIT_MIN_FONT = 8;       // taille de texte minimale (pt)
const FIT_MIN_HEADING = 9.5;  // taille de titre minimale (pt)
const FIT_MIN_SECTION_GAP = 3;// espacement inter-sections minimal (pt)
const FIT_BLOCK_GAP = 3;      // interligne entre blocs d'une même section (pt)
// Valeurs de base par défaut (quand le thème ne les fixe pas) — alignées sur
// `getStyles` (PDF) et `computePaginatedFlow`.
const BASE_FONT = 10;
const BASE_HEADING = 12;
const BASE_SECTION_GAP = 8;
// Limites de page A4 (pt), identiques à `computePaginatedFlow`.
const A4_PAGE_HEIGHT_PT = 842;
const PAGE_BOTTOM_PT = A4_PAGE_HEIGHT_PT - 24;
const OVERFLOW_TOL_PT = 16;

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

  /**
   * Réalignement PRÉSERVANT le placement manuel : conserve la position X de
   * chaque bloc, l'ordre vertical actuel, la page de chaque bloc ET l'en-tête
   * tel que l'utilisateur l'a déplacé. Ne fait que résoudre les chevauchements
   * (pousse vers le bas un bloc qui recouvrirait le précédent, hauteurs réelles
   * mesurées). Utilisé après un changement de thème (taille/police/espacement) :
   * le CV « s'adapte à l'état actuel » au lieu de revenir à la disposition
   * initiale du template.
   */
  const relaxPreservingPositions = useCallback((): Record<string, BlockPos> | null => {
    const { data: d, layout: l, template: tpl } = reflowRefs.current;
    const defaults = computeDefaultPositions(tpl, d);
    const saved = l.absolutePositions ?? {};
    const ids = new Set([...Object.keys(defaults), ...Object.keys(saved)]);
    if (ids.size === 0) return null;

    const positions: Record<string, BlockPos> = {};
    for (const id of ids) positions[id] = { ...(defaults[id] ?? {}), ...(saved[id] ?? {}) } as BlockPos;

    const SECTION_GAP = l.theme?.sectionMargin ?? 8;
    const BLOCK_GAP = 3;
    const { sidebar, main } = getColumnSections(l);

    // Pousse vers le bas, page par page, les blocs d'une colonne qui se
    // chevaucheraient — en respectant leur ordre vertical et leur X actuels.
    const relaxColumn = (sectionIds: string[]) => {
      const blocks = sectionIds
        .flatMap((s) => getSectionBlockIds(s, d))
        .filter((b) => positions[b]);
      const pageOf = (b: string) => positions[b].page ?? 0;
      for (const page of new Set(blocks.map(pageOf))) {
        const group = blocks.filter((b) => pageOf(b) === page).sort((a, b) => positions[a].y - positions[b].y);
        let prevBottom: number | null = null;
        let prevParent: string | null = null;
        for (const id of group) {
          const pos = positions[id];
          const h = measureHeightPt(id) ?? pos.h ?? 20;
          let y = pos.y;
          if (prevBottom !== null) {
            const gap = getParentSectionId(id) !== prevParent ? SECTION_GAP : BLOCK_GAP;
            y = Math.max(y, prevBottom + gap);
          }
          positions[id] = { ...pos, y: Math.round(y), h: undefined };
          prevBottom = y + h;
          prevParent = getParentSectionId(id);
        }
      }
    };

    relaxColumn(sidebar);
    relaxColumn(main);
    // L'en-tête (name / role / techLine / contactLine / photo) n'est jamais
    // restacké : il garde la position où l'utilisateur l'a déplacé.
    return positions;
  }, [measureHeightPt]);

  // Variante différée (double rAF) du réalignement préservant — attend le
  // re-rendu au nouveau thème avant de re-mesurer les hauteurs.
  const realignPreservingAfterRender = useCallback(() => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const { data: d, layout: l, onChange: oc } = reflowRefs.current;
        const positions = relaxPreservingPositions();
        if (positions) {
          oc({ ...d, layout: { ...l, useAbsolutePositioning: true, absolutePositions: positions } });
        }
      })
    );
  }, [relaxPreservingPositions]);

  /**
   * Auto-ajustement « une seule page » : à partir des hauteurs RÉELLES mesurées,
   * calcule un facteur d'échelle pour faire tenir le contenu sur une page A4 en
   * réduisant proportionnellement la taille du texte, des titres et des
   * espacements — sans jamais descendre sous les planchers de lisibilité.
   *
   * Renvoie le thème ajusté (à appliquer puis réaligner) si une réduction est
   * nécessaire ET utile, sinon `null` (le contenu tient déjà, ou il est si dense
   * qu'on est déjà au plancher → on laissera la pagination créer une 2ᵉ page).
   */
  const computeAutoFitTheme = useCallback((): CVTheme | null => {
    const { sidebar, main } = getColumnSections(layout);
    const theme = layout.theme ?? {};
    const baseFont = theme.fontSize ?? BASE_FONT;
    const baseHeading = theme.headingSize ?? BASE_HEADING;
    const baseGap = theme.sectionMargin ?? BASE_SECTION_GAP;

    // Hauteur d'une colonne empilée sur UNE page (somme des hauteurs mesurées +
    // espacements), avec la même règle de marge que `computePaginatedFlow`.
    const columnHeight = (sections: string[]): number => {
      const blocks: { id: string; h: number }[] = [];
      for (const s of sections) {
        for (const id of getSectionBlockIds(s, data)) {
          const h = measureHeightPt(id);
          if (h != null) blocks.push({ id, h });
        }
      }
      let total = 0;
      for (let i = 0; i < blocks.length; i++) {
        if (i > 0) {
          const changedSection = getParentSectionId(blocks[i].id) !== getParentSectionId(blocks[i - 1].id);
          total += changedSection ? baseGap : FIT_BLOCK_GAP;
        }
        total += blocks[i].h;
      }
      return total;
    };

    const contentHeight = Math.max(columnHeight(sidebar), columnHeight(main));
    if (contentHeight <= 0) return null;

    const firstStart = isModernTemplate(template) ? 100 : 95;
    const capacity = PAGE_BOTTOM_PT - firstStart + OVERFLOW_TOL_PT;

    // Tient déjà sur une page → aucune réduction (laisse le réalignement normal).
    if (contentHeight <= capacity) return null;

    // Faisable de tenir sur une page une fois réduit au plancher de lisibilité ?
    // Sinon, on ne rapetisse pas inutilement le texte : on garde une taille
    // lisible et on laisse la pagination créer une 2ᵉ page (trop de contenu).
    const minScale = FIT_MIN_FONT / baseFont;
    if (contentHeight * minScale > capacity) return null;

    // Facteur visé (petite marge de sécurité pour absorber les non-linéarités du
    // retour à la ligne) borné à [plancher, 1[.
    const k = Math.min(1, (capacity * 0.98) / contentHeight);
    const fontSize = Math.max(FIT_MIN_FONT, Math.round(baseFont * k * 2) / 2);
    const headingSize = Math.max(FIT_MIN_HEADING, Math.round(baseHeading * k * 2) / 2);
    const sectionMargin = Math.max(FIT_MIN_SECTION_GAP, Math.round(baseGap * k));

    // Déjà au plancher (ou aucune réduction effective) → inutile de réécrire le
    // thème ; la pagination basculera sur une 2ᵉ page.
    const unchanged =
      fontSize === (theme.fontSize ?? BASE_FONT) &&
      headingSize === (theme.headingSize ?? BASE_HEADING) &&
      sectionMargin === (theme.sectionMargin ?? BASE_SECTION_GAP);
    if (unchanged) return null;

    return { ...theme, fontSize, headingSize, sectionMargin };
  }, [data, layout, template, measureHeightPt]);

  // « Tout réaligner » : tente d'abord de condenser le CV sur UNE page (réduction
  // mesurée des tailles/espacements jusqu'aux planchers de lisibilité), puis
  // reflow à partir des hauteurs RÉELLES — empilement sans chevauchement, et 2ᵉ
  // page seulement si le contenu reste trop dense au plancher.
  const realign = useCallback(() => {
    const fitTheme = computeAutoFitTheme();
    if (fitTheme) {
      // Applique le thème condensé, puis réaligne sur les hauteurs re-mesurées
      // (le double rAF de `realignAfterRender` attend le re-rendu au nouveau thème).
      onChange({ ...data, layout: { ...layout, theme: fitTheme } });
      realignAfterRender();
      return;
    }
    const nextLayout = buildPaginatedLayout(data, layout, template);
    if (!nextLayout) return;
    onChange({ ...data, layout: nextLayout });
  }, [data, layout, template, onChange, buildPaginatedLayout, computeAutoFitTheme, realignAfterRender]);

  /** Mise à jour du thème depuis la toolbar. `reflow` : les tailles/espacements
   *  ont changé → on réaligne en PRÉSERVANT le placement manuel des blocs et de
   *  l'en-tête (on ne revient pas à la disposition initiale du template) ; seuls
   *  les chevauchements sont résolus sur les nouvelles hauteurs mesurées. */
  const updateTheme = useCallback(
    (updates: Partial<CVTheme>, opts?: { reflow?: boolean }) => {
      const { data: d, layout: l, onChange: oc } = reflowRefs.current;
      if (Object.keys(updates).length > 0) {
        oc({ ...d, layout: { ...l, theme: { ...(l.theme ?? {}), ...updates } } });
      }
      if (opts?.reflow) realignPreservingAfterRender();
    },
    [realignPreservingAfterRender]
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

  // La page canva fait TOUJOURS exactement une page A4 (comme le PDF) — jamais
  // une page « étirée ». Le contenu qui déborde est reporté sur la page suivante
  // par la pagination automatique (effet ci-dessous), exactement comme le PDF.
  const pageHeightPx = A4_HEIGHT_PX;

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
