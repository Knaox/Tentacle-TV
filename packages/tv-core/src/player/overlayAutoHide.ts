import type { PlayerTimers } from "./playerTimers";

/** L'habillage s'éteint seul après ce délai sans geste — en lecture, sans panneau. */
export const OVERLAY_HIDE_MS = 5000;

export interface OverlayAutoHide {
  /**
   * L'habillage paraît (ou reste) : la minuterie d'extinction repart de zéro
   * — sauf en pause (l'habillage y est épinglé) ou panneau ouvert (il reste
   * sous le panneau). Les conditions sont lues AU MOMENT de l'appel.
   */
  reveal: (conditions: { paused: boolean; panelOpen: boolean }) => void;
  /** L'habillage s'éteint tout de suite ; la minuterie avec. */
  hide: () => void;
  /** La minuterie seule s'arrête (l'habillage reste tel quel). */
  cancelTimer: () => void;
  destroy: () => void;
}

/**
 * L'extinction de l'habillage du lecteur. Module pur : la visibilité sort par
 * `onVisible` (le lecteur en tient l'état), minuteurs injectés.
 */
export function createOverlayAutoHide({ onVisible, timers }: {
  onVisible: (visible: boolean) => void;
  timers: PlayerTimers;
}): OverlayAutoHide {
  let timer: unknown = null;
  const cancelTimer = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  return {
    reveal({ paused, panelOpen }) {
      onVisible(true);
      cancelTimer();
      if (!paused && !panelOpen) {
        timer = timers.setTimeout(() => {
          timer = null;
          onVisible(false);
        }, OVERLAY_HIDE_MS);
      }
    },
    hide() {
      cancelTimer();
      onVisible(false);
    },
    cancelTimer,
    destroy: cancelTimer,
  };
}
