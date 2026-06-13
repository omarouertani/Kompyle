"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { A4_WIDTH_PX } from "../cv-canvas-primitives";
import { ZOOM_MIN, ZOOM_MAX } from "./CanvasToolbar";

interface UseCanvasZoomArgs {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Reporte l'échelle finale à useCanvasInteractions (conversion px → pt). */
  onScaleChange: (scale: number) => void;
}

/** Zoom du canvas : Ctrl/Cmd + molette, « Ajuster à l'écran », et suivi de
 *  l'échelle finale (baseScale × zoom) rapportée par le wrapper de page. */
export function useCanvasZoom({ scrollContainerRef, onScaleChange: reportScale }: UseCanvasZoomArgs) {
  const [zoom, setZoom] = useState(1);

  // Échelle finale (baseScale × zoom) rapportée par le wrapper — sert au
  // calcul du zoom « Ajuster à l'écran ».
  const finalScaleRef = useRef(1);
  const onScaleChange = useCallback(
    (s: number) => {
      finalScaleRef.current = s;
      reportScale(s);
    },
    [reportScale]
  );

  // Zoom « Ajuster » : la page remplit la largeur visible du canvas.
  const fitToScreen = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setZoom((currentZoom) => {
      const baseScale = currentZoom > 0 ? finalScaleRef.current / currentZoom : 1;
      if (!baseScale) return 1;
      const desired = (el.clientWidth - 48) / A4_WIDTH_PX;
      return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, desired / baseScale));
    });
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      setZoom((prev) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, prev + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [scrollContainerRef]);

  return { zoom, setZoom, fitToScreen, onScaleChange };
}
