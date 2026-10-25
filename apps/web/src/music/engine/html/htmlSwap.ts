/**
 * La bascule à chaud du moteur web : DEUX éléments et un fondu court.
 *
 * La nouvelle source est ouverte muette, placée un peu DEVANT la lecture
 * (`LEAD_S`), et lancée quand le courant atteint ce point (moins la latence de
 * démarrage mesurée) ; un fondu à puissance constante de 40 ms passe de l'un à
 * l'autre. Deux éléments ne s'alignent pas à l'échantillon : le fondu cache
 * l'écart restant (mesuré au banc web). En pause, rien ne s'entend : la
 * nouvelle source prend la place, à la même position, sans fondu.
 */

import { crossfadeCurve } from "./htmlRules";
import { whenReady, type Slot } from "./htmlSlot";

export const LEAD_S = 0.6;
const FADE_STEPS = 8;
const FADE_STEP_MS = 5;

export interface SwapTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
  now: () => number;
}

export interface SwapRun {
  cancel: () => void;
}

/**
 * Lance la bascule de `from` vers `to` (déjà créé, pas encore lancé).
 * `done(to)` quand `to` joue seul ; `targetVolume()` lu à chaque pas (le volume
 * peut changer pendant le fondu).
 */
export function crossfadeSwap(
  from: Slot,
  to: Slot,
  timers: SwapTimers,
  latency: { get: () => number; measured: (ms: number) => void },
  targetVolume: () => number,
  done: (to: Slot) => void,
): SwapRun {
  let cancelled = false;
  const pending: unknown[] = [];
  const later = (fn: () => void, ms: number): void => {
    pending.push(timers.setTimeout(() => !cancelled && fn(), ms));
  };
  to.el.volume = 0;
  if (from.el.paused) {
    whenReady(to, () => {
      if (cancelled) return;
      to.el.currentTime = from.el.currentTime;
      to.el.volume = targetVolume();
      done(to);
    });
    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }
  const fade = (step: number): void => {
    const curve = crossfadeCurve(FADE_STEPS);
    const point = curve[step];
    if (point === undefined) {
      from.el.volume = 0;
      to.el.volume = targetVolume();
      done(to);
      return;
    }
    const v = targetVolume();
    from.el.volume = v * point.out;
    to.el.volume = v * point.in;
    later(() => fade(step + 1), FADE_STEP_MS);
  };
  // Placée devant la lecture ; si le courant l'a déjà dépassée le temps que
  // l'élément se place, on vise plus loin.
  let target = 0;
  let started = false;
  let fading = false;
  const arm = (): void => {
    target = from.el.currentTime + LEAD_S;
    to.el.currentTime = target;
  };
  to.on("seeked", () => {
    if (started || cancelled) return;
    const delay = (target - from.el.currentTime) * 1000 - latency.get();
    if (delay < 0) return arm();
    started = true;
    later(() => {
      playAt = timers.now();
      void to.el.play().catch(() => undefined);
    }, delay);
  });
  let playAt = 0;
  to.on("playing", () => {
    if (!started || fading || cancelled) return;
    fading = true;
    latency.measured(timers.now() - playAt);
    fade(0);
  });
  whenReady(to, () => !cancelled && arm());
  return {
    cancel: () => {
      cancelled = true;
      for (const id of pending) timers.clearTimeout(id);
    },
  };
}
