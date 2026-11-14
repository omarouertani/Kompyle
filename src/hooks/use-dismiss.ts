"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Ferme un menu / popover ouvert dès qu'on clique AILLEURS ou qu'on appuie sur
 * Échap — sans avoir à cliquer sur « × ».
 *
 * Écoute en phase de CAPTURE sur le document : fonctionne même si un élément
 * stoppe la propagation (canvas, éditeur) et même quand le menu vit dans un
 * parent avec `backdrop-filter` / `transform`, où un calque `fixed inset-0`
 * ne couvre plus l'écran. `refs` : zones considérées comme « dedans » (bouton
 * déclencheur + panneau, y compris un panneau rendu dans un portail).
 */
export function useDismiss(open: boolean, onClose: () => void, ...refs: RefObject<HTMLElement | null>[]) {
  const onCloseRef = useRef(onClose);
  const refsRef = useRef(refs);
  useEffect(() => {
    onCloseRef.current = onClose;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && refsRef.current.some((r) => r.current?.contains(target))) return;
      onCloseRef.current();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
}
