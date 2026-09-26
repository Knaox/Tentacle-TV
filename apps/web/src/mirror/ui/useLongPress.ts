import { useCallback, useRef } from "react";

const DELAY_MS = 450;
const MOVE_TOLERANCE = 10;

/**
 * L'appui long de l'app (`onLongPress` de React Native, 500 ms ; 450 ici pour
 * devancer le menu contextuel du navigateur). Un doigt qui bouge de plus de dix
 * pixels défile : il n'appuie pas. Le clic qui suit un appui long est avalé,
 * et un retour haptique court le signale là où le navigateur le permet.
 */
export function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onLongPress || (e.pointerType === "mouse" && e.button !== 0)) return;
      fired.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        timer.current = null;
        try {
          navigator.vibrate?.(10);
        } catch {
          /* pas de vibreur : rien à signaler */
        }
        onLongPress();
      }, DELAY_MS);
    },
    [onLongPress],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const o = origin.current;
      if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > MOVE_TOLERANCE) cancel();
    },
    [cancel],
  );

  /** À appeler en tête du `onClick` : `true` si ce clic termine un appui long. */
  const consumeClick = useCallback(() => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu: (e: React.MouseEvent) => {
        if (onLongPress) e.preventDefault();
      },
    },
    consumeClick,
  };
}
