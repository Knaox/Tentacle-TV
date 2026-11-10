import { useCallback, useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";

/**
 * Les gestes qui font défiler une bannière, en plus de ses flèches et de ses pastilles :
 *  - clavier : ← et → quand le focus est dans la bannière (jamais dans un champ) ;
 *  - souris / pavé tactile : la molette HORIZONTALE (un balayage à deux doigts) ;
 *  - doigt ou stylet : un glissé horizontal.
 * La molette verticale reste au défilement de la page, et la souris ne glisse rien : un clic
 * maintenu sur une image n'est pas un geste de carrousel au bureau.
 */

/** Course horizontale au-delà de laquelle un geste vaut « suivant / précédent ». */
export const SWIPE_DISTANCE_PX = 48;
/** Molette horizontale cumulée qui vaut un pas. */
export const WHEEL_STEP_PX = 60;
/** Après un pas à la molette, le reste de l'élan du pavé tactile est ignoré. */
export const WHEEL_COOLDOWN_MS = 450;

export type BillboardStep = "prev" | "next" | null;

/** ← recule, → avance ; rien avec un modificateur (raccourcis du navigateur). */
export function stepForKey(key: string, modified: boolean): BillboardStep {
  if (modified) return null;
  if (key === "ArrowLeft") return "prev";
  if (key === "ArrowRight") return "next";
  return null;
}

/** Un glissé surtout horizontal, assez long : vers la gauche il AVANCE (on tire la suivante). */
export function stepForSwipe(dx: number, dy: number): BillboardStep {
  if (Math.abs(dx) < SWIPE_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? "next" : "prev";
}

/** La molette ne compte que si elle est surtout horizontale. */
export function wheelIsHorizontal(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY) && deltaX !== 0;
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function useBillboardGestures({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const wheel = useRef({ sum: 0, lockedUntil: 0 });
  const touch = useRef<{ id: number; x: number; y: number } | null>(null);
  const go = useCallback((step: BillboardStep) => {
    if (step === "prev") onPrev();
    else if (step === "next") onNext();
  }, [onPrev, onNext]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    const step = stepForKey(e.key, e.altKey || e.ctrlKey || e.metaKey || e.shiftKey);
    if (!step) return;
    e.preventDefault();
    go(step);
  }, [go]);

  const onWheel = useCallback((e: WheelEvent) => {
    if (!wheelIsHorizontal(e.deltaX, e.deltaY)) return;
    const now = performance.now();
    const state = wheel.current;
    if (now < state.lockedUntil) return;
    state.sum += e.deltaX;
    if (Math.abs(state.sum) < WHEEL_STEP_PX) return;
    go(state.sum > 0 ? "next" : "prev");
    state.sum = 0;
    state.lockedUntil = now + WHEEL_COOLDOWN_MS;
  }, [go]);

  const onPointerDown = useCallback((e: PointerEvent) => {
    touch.current = e.pointerType === "mouse" ? null : { id: e.pointerId, x: e.clientX, y: e.clientY };
  }, []);
  const onPointerUp = useCallback((e: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (start && start.id === e.pointerId) go(stepForSwipe(e.clientX - start.x, e.clientY - start.y));
  }, [go]);
  const onPointerCancel = useCallback(() => {
    touch.current = null;
  }, []);

  return { onKeyDown, onWheel, onPointerDown, onPointerUp, onPointerCancel };
}
