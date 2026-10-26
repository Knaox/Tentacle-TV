/**
 * Octave — le glisser d'une rangée par sa POIGNÉE (souris, stylet, doigt) :
 * la rangée tenue suit le pointeur, les autres s'écartent, la page défile près
 * des bords ; au lâcher, `onMove(from, to)`. Échap annule. Tout est en
 * `transform` (aucune remise en page), une mise à jour par image au plus.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { DRAG_THRESHOLD_PX, dragTarget, edgeScrollSpeed } from "./dragGeometry";

export interface RowDragState {
  from: number;
  over: number;
  /** Le déplacement de la rangée tenue (px), défilement compris. */
  offset: number;
}

interface Gesture {
  pointerId: number;
  from: number;
  startY: number;
  startScroll: number;
  lastY: number;
  started: boolean;
}

export function useRowDrag(count: number, onMove: (from: number, to: number) => void, scrollElement: () => HTMLElement | null) {
  const [drag, setDrag] = useState<RowDragState | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const live = useRef({ count, onMove, scrollElement });
  live.current = { count, onMove, scrollElement };

  const compute = useCallback((): RowDragState | null => {
    const g = gesture.current;
    if (!g?.started) return null;
    const scroll = live.current.scrollElement()?.scrollTop ?? 0;
    const offset = g.lastY - g.startY + (scroll - g.startScroll);
    return { from: g.from, over: dragTarget(g.from, offset, live.current.count), offset };
  }, []);

  // Une image : la place, puis le défilement automatique près d'un bord (qui relance l'image suivante).
  const tick = useCallback(() => {
    frame.current = 0;
    const g = gesture.current;
    if (!g?.started) return;
    const el = live.current.scrollElement();
    if (el) {
      const box = el.getBoundingClientRect();
      const speed = edgeScrollSpeed(g.lastY, box.top, box.bottom);
      if (speed !== 0) el.scrollTop += speed;
      if (speed !== 0) frame.current = requestAnimationFrame(tick);
    }
    setDrag(compute());
  }, [compute]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(tick);
  }, [tick]);

  const end = useCallback((commit: boolean) => {
    const state = compute();
    gesture.current = null;
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    setDrag(null);
    if (commit && state && state.over !== state.from) live.current.onMove(state.from, state.over);
  }, [compute]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && gesture.current?.started) end(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [end]);

  /** À poser sur la poignée de la rangée `index`. */
  const handleProps = useCallback(
    (index: number) => ({
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        gesture.current = { pointerId: e.pointerId, from: index, startY: e.clientY, startScroll: live.current.scrollElement()?.scrollTop ?? 0, lastY: e.clientY, started: false };
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const g = gesture.current;
        if (!g || g.pointerId !== e.pointerId) return;
        g.lastY = e.clientY;
        if (!g.started && Math.abs(e.clientY - g.startY) < DRAG_THRESHOLD_PX) return;
        g.started = true;
        schedule();
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        if (gesture.current?.pointerId === e.pointerId) end(true);
      },
      onPointerCancel: () => end(false),
      // Le clic qui termine un geste ne lit pas le titre de la rangée.
      onClick: (e: ReactMouseEvent<HTMLElement>) => e.stopPropagation(),
    }),
    [end, schedule],
  );

  return { drag, handleProps };
}
