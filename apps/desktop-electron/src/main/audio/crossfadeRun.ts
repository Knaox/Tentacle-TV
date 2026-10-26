/**
 * Un fondu en cours entre deux instances (`crossfadeDecks.ts`) : ses deux minuteries — la mi-fondu (le titre
 * qui arrive passe devant) et la fin (l'instance qui part s'arrête, sa sortie vidée) — tenues en temps de
 * LECTURE : une pause les suspend avec les deux instances, la reprise repart d'où elles en étaient. Les courbes,
 * elles, suivent le flux de chaque instance (`crossfadeFilter.ts`) et n'ont besoin de rien.
 */

import type { AudioBridgeControl, AudioBridgeSource, AudioBridgeTrack } from "./audioBridgeContract";
import type { DeckTimeline } from "./crossfadeFilter";

/** Le suivant à fondre : son titre, sa source, la durée du fondu (s). */
export interface Pending {
  track: AudioBridgeTrack;
  source: AudioBridgeSource;
  fadeS: number;
}

export interface FadeDeck {
  control(c: AudioBridgeControl): void;
  timeline(): DeckTimeline;
}

export class DeckFade<D extends FadeDeck = FadeDeck> {
  passedMid = false;
  private timers: Array<ReturnType<typeof setTimeout>> = [];
  private elapsedMs = 0;
  private since: number;
  private running = true;

  constructor(
    readonly from: D,
    readonly to: D,
    readonly pending: Pending,
    /** Le titre qui part : le `fromKey` de `advanced`. */
    readonly fromKey: string | null,
    private readonly hooks: { mid: () => void; end: () => void },
    private readonly tailMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.since = now();
    this.schedule();
  }

  private schedule(): void {
    const fadeMs = this.pending.fadeS * 1000;
    if (!this.passedMid) this.timers.push(setTimeout(this.hooks.mid, Math.max(0, fadeMs / 2 - this.elapsedMs)));
    this.timers.push(setTimeout(this.hooks.end, Math.max(0, fadeMs + this.tailMs - this.elapsedMs)));
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.elapsedMs += this.now() - this.since;
    this.cancel();
    for (const d of [this.from, this.to]) d.control({ action: "pause" });
  }

  resume(): void {
    if (this.running) return;
    this.running = true;
    this.since = this.now();
    // Le titre qui part et qui a déjà fini se tait : relancé, il repartirait de son début.
    if (!this.from.timeline().ended) this.from.control({ action: "resume" });
    this.to.control({ action: "resume" });
    this.schedule();
  }

  cancel(): void {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }
}
