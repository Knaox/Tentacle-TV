/**
 * Les deux horloges du moteur, sorties de `audioEngine.ts` : la relecture
 * d'une fin PROVISOIRE (fichier qui grandit) et l'étranglement de l'état
 * poussé vers la page.
 */

import { progressed, reloadDelayMs } from "./partialSource";

/**
 * Une fin provisoire : relire à la position après un délai croissant, en
 * comptant les relectures qui n'ont rien gagné (`isRealEnd` s'en sert).
 */
export class ProvisionalEnd {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stalled = 0;
  private lastAtMs: number | null = null;

  pending(): boolean {
    return this.timer !== null;
  }

  stalledReloads(): number {
    return this.stalled;
  }

  /** Un nouveau titre (pas une relecture) : on repart de zéro. */
  reset(): void {
    this.cancel();
    this.stalled = 0;
    this.lastAtMs = null;
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /**
   * Relit dans `reloadDelayMs` : `still()` dit si la fin tient toujours,
   * `positionMs()` où on en est, `reload` relit à cette position (s).
   */
  schedule(still: () => boolean, positionMs: () => number, reload: (positionS: number) => void): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!still()) return;
      const at = positionMs();
      if (!progressed(this.lastAtMs, at)) this.stalled += 1;
      this.lastAtMs = at;
      reload(at / 1000);
    }, reloadDelayMs(this.stalled));
  }
}

/**
 * Au plus une émission par `intervalMs` pour ce qui bouge (la position) ; le
 * reste part au tour suivant de la boucle, REGROUPÉ — un fichier qui démarre
 * change une dizaine de propriétés dans la même vidange de mpv, la page doit
 * en recevoir un état, pas dix.
 */
export class StateThrottle {
  private last = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queued = false;

  constructor(private readonly intervalMs: number, private readonly flush: (at: number) => void) {}

  push(throttled: boolean): void {
    if (!throttled) {
      if (this.queued) return;
      this.queued = true;
      queueMicrotask(() => {
        this.queued = false;
        this.emitNow();
      });
      return;
    }
    const now = Date.now();
    if (throttled && now - this.last < this.intervalMs) {
      if (this.timer === null) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.emitNow();
        }, this.intervalMs - (now - this.last));
      }
      return;
    }
    this.emitNow();
  }

  private emitNow(): void {
    this.cancel();
    this.last = Date.now();
    this.flush(this.last);
  }

  cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
