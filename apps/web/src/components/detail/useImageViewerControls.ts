import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

interface Controls {
  open: boolean;
  count: number;
  onClose: () => void;
  onStep: (delta: number) => void;
  dialogRef: RefObject<HTMLDivElement | null>;
  initialFocusRef: RefObject<HTMLButtonElement | null>;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * Le comportement de la visionneuse, à part de son rendu :
 *  • clavier — Échap ferme, ← / → parcourent, Tab reste DANS la boîte ;
 *  • focus — posé sur « Fermer » à l'ouverture, rendu à ce qui l'avait avant ;
 *  • défilement de la page gelé tant qu'elle est ouverte (sinon la molette
 *    faisait défiler la fiche sous l'image).
 */
export function useImageViewerControls({ open, count, onClose, onStep, dialogRef, initialFocusRef }: Controls) {
  const returnFocus = useRef<HTMLElement | null>(null);
  // Les rappels changent à chaque rendu de la page ; l'écouteur, lui, ne doit
  // être posé qu'une fois par ouverture.
  const latest = useRef({ onClose, onStep, count });
  useLayoutEffect(() => {
    latest.current = { onClose, onStep, count };
  });

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => initialFocusRef.current?.focus(), 0);

    const onKey = (e: KeyboardEvent) => {
      const { onClose: close, onStep: step, count: total } = latest.current;
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key === "ArrowRight" && total > 1) { e.preventDefault(); step(1); return; }
      if (e.key === "ArrowLeft" && total > 1) { e.preventDefault(); step(-1); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      root.style.overflow = previousOverflow;
      returnFocus.current?.focus?.();
    };
  }, [open, dialogRef, initialFocusRef]);
}

/** Glisser horizontal (tactile) : au-delà de 48 px, on change d'image. */
export function swipeDelta(startX: number, endX: number): number {
  const dx = endX - startX;
  if (Math.abs(dx) < 48) return 0;
  return dx < 0 ? 1 : -1;
}
