import { useEffect, type RefObject } from "react";
import { swipeArms, swipeCloses, swipeOffset } from "./swipeDismiss";

const SETTLE = "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)";
const LEAVE_MS = 200;

/**
 * Glisser la feuille vers le bas la ferme (au doigt seulement : la souris garde
 * ⌄ et Échap). Le déplacement s'écrit directement en `transform` sur la
 * feuille — aucun rendu React par image ; la décision est `swipeDismiss.ts`.
 * Une zone `data-swipe-keep` (une liste qui défile seule) garde ses gestes.
 * Un `touchmove` non passif retient le défilement du navigateur une fois le
 * geste armé (sinon la page rebondirait sous la feuille).
 */
export function useSwipeDismiss(sheet: RefObject<HTMLElement | null>, onClose: () => void, enabled: boolean): void {
  useEffect(() => {
    const el = sheet.current;
    if (!el || !enabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let start: { x: number; y: number; t: number } | null = null;
    let armed = false;
    let last = { y: 0, t: 0, v: 0 };

    const place = (y: number, transition: string) => {
      el.style.transition = transition;
      el.style.transform = y === 0 ? "" : `translate3d(0, ${y}px, 0)`;
    };
    const onStart = (e: TouchEvent) => {
      // Une liste qui défile seule dans la feuille (la file d'attente) garde ses gestes.
      if (e.touches.length !== 1 || (e.target instanceof Element && e.target.closest("[data-swipe-keep]"))) return;
      const p = e.touches[0];
      start = { x: p.clientX, y: p.clientY, t: e.timeStamp };
      armed = false;
      last = { y: 0, t: e.timeStamp, v: 0 };
    };
    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const p = e.touches[0];
      const dx = p.clientX - start.x;
      const dy = p.clientY - start.y;
      if (!armed) {
        if (!swipeArms(dx, dy, el.scrollTop)) {
          if (Math.abs(dx) > 10 || dy < -10 || el.scrollTop > 0) start = null; // ce geste n'est pas le nôtre
          return;
        }
        armed = true;
        el.style.animation = "none"; // l'entrée (`fill: both`) l'emporterait sur la translation écrite
      }
      e.preventDefault();
      const dt = Math.max(1, e.timeStamp - last.t);
      last = { y: dy, t: e.timeStamp, v: (dy - last.y) / dt };
      place(swipeOffset(dy), "none");
    };
    const onEnd = () => {
      if (!start) return;
      const wasArmed = armed;
      start = null;
      armed = false;
      if (!wasArmed) return;
      if (swipeCloses(last.y, last.v, el.clientHeight)) {
        if (reduce) return onClose();
        place(el.clientHeight, `transform ${LEAVE_MS}ms cubic-bezier(0.4, 0, 1, 1)`);
        window.setTimeout(onClose, LEAVE_MS);
      } else {
        place(0, reduce ? "none" : SETTLE);
      }
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [sheet, onClose, enabled]);
}
