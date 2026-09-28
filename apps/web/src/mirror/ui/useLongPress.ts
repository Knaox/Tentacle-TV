import { useCallback, useRef } from "react";

const DELAY_MS = 450;
const MOVE_TOLERANCE = 10;
/** Après le relâcher, le délai au-delà duquel plus aucun clic fantôme n'est attendu. */
const GHOST_CLICK_WINDOW_MS = 600;

/**
 * Le clic « fantôme » d'un appui long : au relâcher, le navigateur délivre un
 * clic à ce qui se trouve SOUS le doigt — et c'est désormais la feuille que
 * l'appui vient d'ouvrir. Son voile la refermait aussitôt (constaté au banc :
 * une feuille courte, le doigt au-dessus d'elle), une bascule s'y serait
 * cochée toute seule. Ce clic-là est avalé, une fois, à la capture du
 * document ; le relâcher ouvre une courte fenêtre au-delà de laquelle plus
 * rien n'est retenu (un navigateur qui n'en émet pas ne perd pas le suivant).
 */
function swallowGhostClick(onDone: () => void) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerup", onUp, true);
    document.removeEventListener("pointercancel", stop, true);
    clearTimeout(timeout);
    onDone();
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stop();
  };
  // Le doigt peut rester posé longtemps : la fenêtre ne s'ouvre qu'au relâcher.
  const onUp = () => {
    clearTimeout(timeout);
    timeout = setTimeout(stop, GHOST_CLICK_WINDOW_MS);
  };
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerup", onUp, true);
  document.addEventListener("pointercancel", stop, true);
}

/**
 * L'appui long de l'app (`onLongPress` de React Native, 500 ms ; 450 ici pour
 * devancer le menu contextuel du navigateur). Un doigt qui bouge de plus de dix
 * pixels défile : il n'appuie pas. Le clic qui suit un appui long est avalé,
 * où qu'il tombe, et un retour haptique court le signale là où le navigateur
 * le permet.
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
        swallowGhostClick(() => {
          fired.current = false;
        });
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
