/**
 * Octave — le glisser d'une rangée par sa POIGNÉE (souris, stylet, doigt) :
 * la rangée tenue suit le pointeur, les autres s'écartent, la page défile près
 * des bords (vitesse selon la proximité du bord, accélérée : la règle partagée
 * `edgeScrollVelocity`) ; au lâcher, `onMove(from, to)`. Échap annule. Tout est
 * en `transform` (aucune remise en page), une mise à jour par image au plus.
 * Le geste se termine TOUJOURS : capture du pointeur perdue, fenêtre quittée,
 * démontage — il s'arrête et la boucle de défilement avec lui.
 */

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { DRAG_THRESHOLD_PX, ROW_HEIGHT, dragTarget, edgeScrollStep, edgeScrollVelocity } from "@tentacle-tv/shared/octave";

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
  /** Arrivée dans une bande de bord (accélération), et l'image précédente (le pas suit la cadence). */
  edgeSince: number;
  lastFrame: number;
}

export function useRowDrag(count: number, onMove: (from: number, to: number) => void, scrollElement: () => HTMLElement | null, rowHeight = ROW_HEIGHT) {
  const [drag, setDrag] = useState<RowDragState | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef(0);
  const live = useRef({ count, onMove, scrollElement, rowHeight });
  live.current = { count, onMove, scrollElement, rowHeight };

  const compute = useCallback((): RowDragState | null => {
    const g = gesture.current;
    if (!g?.started) return null;
    const scroll = live.current.scrollElement()?.scrollTop ?? 0;
    const offset = g.lastY - g.startY + (scroll - g.startScroll);
    return { from: g.from, over: dragTarget(g.from, offset, live.current.count, live.current.rowHeight), offset };
  }, []);

  // Une image : la place, puis le défilement automatique près d'un bord (qui relance l'image suivante).
  const tick = useCallback((now: number) => {
    frame.current = 0;
    const g = gesture.current;
    if (!g?.started) return;
    const el = live.current.scrollElement();
    if (el) {
      const box = el.getBoundingClientRect();
      const held = g.edgeSince < 0 ? 0 : now - g.edgeSince;
      const velocity = edgeScrollVelocity(g.lastY, box.top, box.bottom, held);
      if (velocity === 0) g.edgeSince = -1;
      else {
        if (g.edgeSince < 0) g.edgeSince = now;
        const before = el.scrollTop;
        el.scrollTop = before + edgeScrollStep(velocity, g.lastFrame < 0 ? 16 : now - g.lastFrame);
        // La page bute : la boucle s'arrête (le prochain mouvement la relance).
        if (el.scrollTop !== before) frame.current = requestAnimationFrame(tick);
      }
      g.lastFrame = frame.current ? now : -1;
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
    // Fenêtre quittée en plein geste (Cmd-Tab) : le lâcher n'arrivera jamais ici.
    const onBlur = () => {
      if (gesture.current) end(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onBlur);
      gesture.current = null;
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
        gesture.current = { pointerId: e.pointerId, from: index, startY: e.clientY, startScroll: live.current.scrollElement()?.scrollTop ?? 0, lastY: e.clientY, started: false, edgeSince: -1, lastFrame: -1 };
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
      // La capture perdue (poignée démontée, autre fenêtre) : le geste se termine là, jamais une boucle sans fin.
      onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => {
        if (gesture.current?.pointerId === e.pointerId) end(true);
      },
      // Le clic qui termine un geste ne lit pas le titre de la rangée.
      onClick: (e: ReactMouseEvent<HTMLElement>) => e.stopPropagation(),
    }),
    [end, schedule],
  );

  return { drag, handleProps };
}
