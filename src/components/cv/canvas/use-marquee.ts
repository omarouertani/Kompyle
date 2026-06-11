"use client";

import { useState, useCallback } from "react";

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Sélection au lasso (rubber-band) : démarrée sur le fond du canvas,
 *  sélectionne tous les blocs `[data-block-id]` que le rectangle croise.
 *  Le rectangle est en coordonnées viewport (rendu en position: fixed). */
export function useMarquee(onSelect: (ids: string[]) => void) {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);

  const startMarquee = useCallback(
    (e: React.MouseEvent, container: HTMLElement) => {
      if (e.button !== 0) return;
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;

      const handleMouseMove = (me: MouseEvent) => {
        if (Math.abs(me.clientX - startX) + Math.abs(me.clientY - startY) < 4) return;
        moved = true;
        setMarqueeRect({
          left: Math.min(startX, me.clientX),
          top: Math.min(startY, me.clientY),
          width: Math.abs(me.clientX - startX),
          height: Math.abs(me.clientY - startY),
        });
      };

      const handleMouseUp = (me: MouseEvent) => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        setMarqueeRect(null);
        if (!moved) return;

        const sel = {
          left: Math.min(startX, me.clientX),
          top: Math.min(startY, me.clientY),
          right: Math.max(startX, me.clientX),
          bottom: Math.max(startY, me.clientY),
        };
        const ids: string[] = [];
        container.querySelectorAll("[data-block-id]").forEach((el) => {
          const r = el.getBoundingClientRect();
          const intersects =
            r.left < sel.right && r.right > sel.left && r.top < sel.bottom && r.bottom > sel.top;
          if (intersects) ids.push(el.getAttribute("data-block-id")!);
        });
        onSelect(ids);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [onSelect]
  );

  return { marqueeRect, startMarquee };
}
