/**
 * La transition douce du moteur web : DEUX éléments qui sonnent ensemble, le volume de chacun mené le long
 * des courbes à puissance constante (`crossfadeRules.ts`).
 *
 * Une seule HORLOGE mène le fondu : la position du titre qui ARRIVE (son `currentTime`, l'horloge audio du
 * navigateur). Une pause, un temps de chargement du suivant gèlent donc les deux courbes ensemble — jamais un
 * titre qui s'éteint pendant que l'autre ne s'est pas encore allumé. Le volume est reposé toutes les
 * `TICK_MS` : 0,4 % d'amplitude d'un pas à l'autre au plus sur 6 s, 1,3 % sur 2 s — mesuré au banc, l'énergie
 * au-dessus de 4 kHz reste à −70 dB sous la musique (6 s) et −53 dB (2 s) : rien d'audible.
 *
 * À mi-fondu, le titre qui arrive devient le COURANT (`mid`) : la barre, la file, les rapports d'écoute
 * basculent au moment où les deux titres s'entendent autant l'un que l'autre.
 */

import { fadeInGain, fadeOutGain } from "../crossfadeRules";
import type { Slot } from "./htmlSlot";
import type { SwapTimers } from "./htmlSwap";

export const TICK_MS = 10;

export interface FadeHooks {
  /** Le volume de l'élément hors fondu (volume voulu, ReplayGain, sourdine). */
  volumeOf: (slot: Slot) => number;
  /** Mi-fondu : le titre qui arrive devient le courant. */
  mid: () => void;
  /** Fin du fondu : le titre parti est libéré. */
  done: () => void;
}

export class CrossfadeRun {
  passedMid = false;
  private timer: unknown = null;
  private finished = false;

  constructor(
    readonly from: Slot,
    readonly to: Slot,
    private readonly durationS: number,
    private readonly timers: SwapTimers,
    private readonly hooks: FadeHooks,
  ) {}

  /** Lance le suivant, muet, et la mesure. */
  start(): void {
    this.apply(0);
    void this.to.el.play().catch(() => undefined);
    this.tick();
  }

  /** La fraction parcourue, lue sur l'horloge du titre qui arrive. */
  progress(): number {
    return Math.min(1, Math.max(0, this.to.el.currentTime / this.durationS));
  }

  /** Les volumes au point `x` du fondu (aussi quand le volume voulu change en cours). */
  apply(x: number = this.progress()): void {
    this.from.el.volume = this.hooks.volumeOf(this.from) * fadeOutGain(x);
    this.to.el.volume = this.hooks.volumeOf(this.to) * fadeInGain(x);
  }

  private tick = (): void => {
    this.timer = null;
    if (this.finished) return;
    const x = this.progress();
    this.apply(x);
    if (!this.passedMid && x >= 0.5) {
      this.passedMid = true;
      this.hooks.mid();
    }
    if (x >= 1) return this.finish();
    this.timer = this.timers.setTimeout(this.tick, TICK_MS);
  };

  private fromEnded(): boolean {
    const d = this.from.el.duration;
    return Number.isFinite(d) && this.from.el.currentTime >= d - 0.01;
  }

  /** Le titre parti s'est tu avant la fin des courbes (sa fin réelle) : rien ne reste à mener. */
  fromStopped(): void {
    if (!this.passedMid) {
      this.passedMid = true;
      this.hooks.mid();
    }
    this.finish();
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancel();
    this.to.el.volume = this.hooks.volumeOf(this.to);
    this.hooks.done();
  }

  pause(): void {
    this.from.el.pause();
    this.to.el.pause();
  }

  /** Reprise : les deux repartent ensemble, l'horloge du suivant mène toujours. */
  resume(): void {
    if (!this.fromEnded()) void this.from.el.play().catch(() => undefined);
    void this.to.el.play().catch(() => undefined);
    if (this.timer === null && !this.finished) this.tick();
  }

  cancel(): void {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }
}
