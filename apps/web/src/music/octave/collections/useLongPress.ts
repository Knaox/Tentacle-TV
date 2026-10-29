/**
 * Octave — l'APPUI LONG sur une carte (doigt, stylet, souris tenue) : 500 ms sans bouger de plus de 8 px ouvrent
 * le menu au point du pointeur, et le clic qui suit le lâcher n'ouvre pas la carte. Un défilement, un glisser, un
 * second doigt l'annulent. Le clic droit garde son propre chemin (`onContextMenu`).
 */

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

export const LONG_PRESS_MS = 500;
export const LONG_PRESS_SLOP_PX = 8;

export function useLongPress(onLongPress: (point: { x: number; y: number }) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const fired = useRef(false);
  const live = useRef(onLongPress);
  live.current = onLongPress;

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || !e.isPrimary) return;
      fired.current = false;
      cancel();
      start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      timer.current = setTimeout(() => {
        const point = start.current;
        cancel();
        if (!point) return;
        fired.current = true;
        live.current({ x: point.x, y: point.y });
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (s && s.id === e.pointerId && Math.hypot(e.clientX - s.x, e.clientY - s.y) > LONG_PRESS_SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    // Le clic qui termine un appui long n'ouvre pas la carte (ni son lien).
    onClickCapture: (e: MouseEvent<HTMLElement>) => {
      if (!fired.current) return;
      fired.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
