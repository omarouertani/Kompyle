"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface UseSpacePanArgs {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

/** Pan « style Canva » : Espace maintenu + glisser → défilement du canvas.
 *
 *  La touche Espace maintenue arme le mode panoramique (curseur « main ») ;
 *  un glissé fait alors défiler le canvas (utile en zoom élevé). Le handler
 *  `handlePanCapture` se branche en phase de CAPTURE pour passer avant les
 *  handlers de drag des blocs / le lasso.
 *
 *  `spaceHeldRef` est exposée pour que l'appelant désactive le lasso tant que
 *  l'Espace est maintenu. */
export function useSpacePan({ scrollContainerRef }: UseSpacePanArgs) {
  const spaceHeldRef = useRef(false);
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanningActive, setIsPanningActive] = useState(false);

  // La touche Espace maintenue arme le mode panoramique.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || spaceHeldRef.current) return;
      const target = e.target as HTMLElement;
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      spaceHeldRef.current = true;
      setIsSpaceHeld(true);
      e.preventDefault(); // empêche le scroll natif de la page
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      spaceHeldRef.current = false;
      setIsSpaceHeld(false);
      setIsPanningActive(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Démarre un panoramique : capté en phase de capture pour passer AVANT les
  // handlers de drag des blocs / le lasso (stopPropagation).
  const handlePanCapture = useCallback(
    (e: React.MouseEvent) => {
      if (!spaceHeldRef.current || e.button !== 0) return;
      const el = scrollContainerRef.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      setIsPanningActive(true);
      const startX = e.clientX;
      const startY = e.clientY;
      const startLeft = el.scrollLeft;
      const startTop = el.scrollTop;
      const move = (me: MouseEvent) => {
        el.scrollLeft = startLeft - (me.clientX - startX);
        el.scrollTop = startTop - (me.clientY - startY);
      };
      const up = () => {
        setIsPanningActive(false);
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [scrollContainerRef]
  );

  return { spaceHeldRef, isSpaceHeld, isPanningActive, handlePanCapture };
}
