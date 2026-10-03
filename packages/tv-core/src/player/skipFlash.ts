import type { PlayerTimers } from "./playerTimers";

/** Fenêtre de cumul des sauts consécutifs (= durée d'affichage du badge). Tant
 *  qu'on ré-appuie dans cette fenêtre et dans le MÊME sens, le badge cumule
 *  (+30 → +60 → +90 ; −10 → −20 → −30). */
export const SKIP_BADGE_MS = 1500;

/** Ce que le badge affiche : le delta cumulé ; `id` change à chaque saut. */
export interface SkipFlashState {
  delta: number;
  id: number;
}

export interface SkipFlash {
  /** Un saut instantané de `delta` secondes vient de partir. */
  flash: (delta: number) => void;
  destroy: () => void;
}

/**
 * Le badge « +30 s / −10 s » d'un saut instantané (appui ←/→, bouton de
 * saut) : juste le delta cumulé, façon Netflix. Un saut en sens opposé (ou
 * hors fenêtre) repart du delta seul ; le badge s'efface 1,5 s après le
 * DERNIER saut, et le cumul avec lui. L'écran d'Apple TV le rend (`SeekFlash`),
 * celui d'Android TV aussi (`TVSkipBadge`).
 *
 * Module pur, minuteurs injectés.
 */
export function createSkipFlash({ onChange, timers }: {
  onChange: (state: SkipFlashState | null) => void;
  timers: PlayerTimers;
}): SkipFlash {
  let accum = 0;
  let timer: unknown = null;
  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };
  return {
    flash(delta) {
      const sameDir = accum !== 0 && Math.sign(delta) === Math.sign(accum);
      accum = sameDir ? accum + delta : delta;
      onChange({ delta: accum, id: timers.now() });
      clear();
      timer = timers.setTimeout(() => {
        timer = null;
        accum = 0;
        onChange(null);
      }, SKIP_BADGE_MS);
    },
    destroy: clear,
  };
}
