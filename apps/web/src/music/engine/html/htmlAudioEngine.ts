/**
 * Le port `AudioEnginePort` sur `<audio>` : le moteur du WEB (et le repli du
 * bureau sans libmpv). Ses capacités sont dites honnêtement : pas de gapless
 * garanti, pas de sortie exclusive, ReplayGain d'après les valeurs de la
 * source seulement (gain positif impossible), bascule à chaud par fondu.
 *
 * Trois cases : le courant, le suivant préchargé (`preload="auto"`), la source
 * de bascule. Le suivant démarre un peu AVANT la fin du courant, de la latence
 * de démarrage mesurée (`htmlRules.ts`) ; l'ancien finit seul ses derniers
 * millisecondes puis est libéré.
 *
 * Transition douce (`setCrossfade`) : entre deux titres enchaînés que la règle
 * autorise (`crossfadeRules.ts`), le suivant démarre AVANT la fin du courant et
 * les deux sonnent ensemble le temps du fondu (`htmlCrossfade.ts`). Un geste
 * lâche le titre quitté comme avant : Chrome adoucit lui-même l'arrêt d'un
 * élément (~40 ms, aucun clic mesuré — mieux qu'une rampe de volume).
 */

import type { AudioEnginePort, MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { MidTrackRecovery } from "@tentacle-tv/shared/octave";
import { albumKeyOf, durationOfSource } from "../engineShared";
import { nextLatencyEstimate, nextStartDelayMs } from "./htmlRules";
import { releaseSlot, remainingS, whenReady, type Slot } from "./htmlSlot";
import { crossfadeSwap, type SwapRun } from "./htmlSwap";
import { plannedCrossfadeMs, sanitizeCrossfadeMs } from "../crossfadeRules";
import { CrossfadeRun } from "./htmlCrossfade";
import { HtmlEngineBase, positionOf } from "./htmlEngineBase";

export type { HtmlEngineDeps } from "./htmlEngineBase";

/** À moins de cela de la fin, le départ du suivant est programmé. */
const ARM_BEFORE_END_S = 1.5;

export class HtmlAudioEngine extends HtmlEngineBase implements AudioEnginePort {
  private swap: SwapRun | null = null;
  private advanceTimer: unknown = null;
  /** `play()` → rendu d'un élément PRÉCHARGÉ : ~10 ms (banc web) ; affinée à chaque départ. */
  private startLatencyMs = 10;
  /** Le même pour un élément tout juste PLACÉ (bascule) : plus lent, ~30 ms au départ. */
  private swapLatencyMs = 30;
  private readonly overrides = new Map<string, PlaybackSource>();
  /** Un titre interrompu en plein milieu (flux rompu, trame illisible) se reprend plus loin (`midTrackRecovery.ts`). */
  private readonly recovery = new MidTrackRecovery();
  private crossfadeMs = 0;
  /** Le fondu prévu vers le suivant préchargé (ms), 0 : enchaînement ordinaire. */
  private nextFadeMs = 0;

  protected onTime(slot: Slot): void {
    this.recovery.played(slot.track.key, slot.el.currentTime * 1000);
    const left = remainingS(slot);
    const fadeS = this.nextFadeMs / 1000;
    if (left === null || this.next === null || this.advanceTimer !== null || this.fade !== null || left > fadeS + ARM_BEFORE_END_S || slot.el.paused) return;
    // Plus assez de place pour le fondu prévu (un saut près de la fin) : ce qui reste, s'il s'entend encore.
    const fadeMs = Math.min(this.nextFadeMs, left * 1000);
    if (fadeMs >= 1000) this.advanceTimer = this.deps.setTimeout(() => this.crossfade(fadeMs), Math.max(0, (left - fadeMs / 1000) * 1000));
    else this.advanceTimer = this.deps.setTimeout(() => this.advance(), nextStartDelayMs(left, this.startLatencyMs));
  }

  protected onEnded(): void {
    if (this.fade !== null) return this.fade.fromStopped();
    if (this.recoverCurrent()) return;
    if (this.next !== null) return this.advance();
    this.patch({ status: "ended", positionMs: this.state.durationMs ?? this.state.positionMs });
  }

  /** Le suivant démarre ; l'ancien finit seul, puis il est libéré. */
  private advance(): void {
    this.advanceTimer = null;
    const from = this.current;
    const to = this.next;
    if (to === null) return;
    this.next = null;
    const t0 = this.deps.now();
    to.on("playing", () => {
      this.startLatencyMs = nextLatencyEstimate(this.startLatencyMs, this.deps.now() - t0);
    });
    void to.el.play().catch(() => this.fail(to));
    if (from !== null) {
      from.off();
      releaseSlot(this.draining);
      this.draining = from;
      from.el.addEventListener("ended", () => {
        if (this.draining !== from) return;
        releaseSlot(from);
        this.draining = null;
      });
    }
    this.becomeCurrent(from, to);
  }

  protected fail(slot: Slot): void {
    if (slot === this.current && this.recoverCurrent()) return;
    super.fail(slot);
  }

  /** Le courant arrêté AVANT sa fin (flux rompu, trame illisible) : un élément neuf le reprend plus loin. */
  private recoverCurrent(): boolean {
    const slot = this.current;
    if (slot === null || this.fade !== null || this.swap !== null) return false;
    const at = this.recovery.take(slot.track.key, durationOfSource(slot.track, slot.source));
    if (at === null) return false;
    console.warn(`[music-engine] « ${slot.track.title} » interrompu : repris à ${(at / 1000).toFixed(1)} s`);
    const resume = this.state.status !== "paused";
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    const fresh = this.slot(slot.track, slot.source);
    releaseSlot(slot);
    this.adopt(fresh);
    this.patch({ status: "buffering", positionMs: at, error: null });
    whenReady(fresh, () => {
      if (this.current !== fresh) return;
      fresh.el.currentTime = at / 1000;
      if (resume) void fresh.el.play().catch(() => this.current === fresh && this.fail(fresh));
    });
    return true;
  }

  /** `to` est désormais le titre courant : état, puis `advanced`. */
  private becomeCurrent(from: Slot | null, to: Slot, setVolume = true): void {
    this.adopt(to, setVolume);
    this.nextFadeMs = 0;
    this.patch({ trackKey: to.track.key, positionMs: positionOf(to), durationMs: durationOfSource(to.track, to.source), format: to.source.format ?? to.track.format });
    this.emitter.emit({ type: "advanced", fromKey: from?.track.key ?? null, toKey: to.track.key });
  }

  /** Le fondu enchaîné vers le suivant préchargé : les deux sonnent ensemble `fadeMs`. */
  private crossfade(fadeMs: number): void {
    this.advanceTimer = null;
    const from = this.current;
    const to = this.next;
    if (from === null || to === null) return;
    this.next = null;
    to.el.muted = this.state.muted;
    // Les gains se figent ici : le suivant d'après, donné à mi-fondu, ne change plus le volume d'aucun des deux.
    [from.gainDb, to.gainDb] = [this.gainDbOf(from), this.gainDbOf(to)];
    const run = new CrossfadeRun(from, to, fadeMs / 1000, this.deps, {
      volumeOf: (slot) => this.volumeFor(slot),
      mid: () => {
        from.off();
        from.on("ended", () => this.fade === run && run.finish());
        this.becomeCurrent(from, to, false);
      },
      done: () => {
        if (this.fade !== run) return;
        this.fade = null;
        releaseSlot(from);
        const later = this.overrides.get(to.track.key);
        this.overrides.delete(to.track.key);
        if (later !== undefined && this.current === to) this.swapSource(to.track.key, later);
      },
    });
    // Le suivant qui échoue avant la mi-fondu : le courant finit seul, le contrôleur enchaînera.
    to.on("error", () => this.fade === run && !run.passedMid && this.dropFade(true));
    this.fade = run;
    run.start();
  }

  /**
   * Le fondu interrompu (saut, autre suivant, échec). Avant la mi-fondu, le titre qui arrivait redevient le
   * suivant préchargé (`keepNext`) ou se tait ; après, c'est le titre parti qui se tait. Le courant reprend
   * son volume plein.
   */
  private dropFade(keepNext: boolean): void {
    const run = this.fade;
    if (run === null) return;
    this.fade = null;
    run.cancel();
    if (!run.passedMid && keepNext) {
      run.to.el.pause();
      run.to.el.currentTime = 0;
      releaseSlot(this.next);
      this.next = run.to;
    } else releaseSlot(run.passedMid ? run.from : run.to);
    this.applyVolumes();
  }

  private served(track: MusicTrack, source: PlaybackSource): PlaybackSource {
    const o = this.overrides.get(track.key);
    if (o === undefined) return source;
    this.overrides.delete(track.key);
    return o.origin === "library" || source.origin !== "library" ? o : source;
  }

  private clearAll(): void {
    this.swap?.cancel();
    this.swap = null;
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.fade?.cancel();
    const fading = this.fadeSlots().filter((s) => s !== this.current);
    this.fade = null;
    for (const s of [this.current, this.next, this.draining, ...fading]) releaseSlot(s);
    this.current = this.next = this.draining = null;
    this.nextFadeMs = 0;
  }

  play(track: MusicTrack, source: PlaybackSource, startMs = 0): void {
    this.clearAll();
    this.recovery.reset();
    const slot = this.slot(track, this.served(track, source));
    this.adopt(slot);
    this.patch({ status: "loading", trackKey: track.key, positionMs: startMs, durationMs: durationOfSource(track, source), format: source.format ?? track.format, error: null });
    const start = (): void => void slot.el.play().catch(() => this.current === slot && this.fail(slot));
    if (startMs > 0) {
      whenReady(slot, () => {
        slot.el.currentTime = startMs / 1000;
        start();
      });
    } else start();
  }

  setNext(track: MusicTrack | null, source: PlaybackSource | null): void {
    const run = this.fade;
    // Le titre qui arrive déjà dans le fondu, redit : rien ne change.
    if (run !== null && !run.passedMid && track?.key === run.to.track.key && source?.url === run.to.source.url) return;
    if (run !== null && !run.passedMid) this.dropFade(false);
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    releaseSlot(this.next);
    this.next = track !== null && source !== null ? this.slot(track, this.served(track, source)) : null;
    if (this.next !== null) this.next.el.load();
    this.nextFadeMs = this.planFade();
    this.applyVolumes();
  }

  /** Le fondu vers le suivant préchargé, d'après la règle (`crossfadeRules.ts`). */
  private planFade(): number {
    const [cur, next] = [this.current, this.next];
    if (cur === null || next === null || this.crossfadeMs === 0) return 0;
    const pair = { current: cur.track, next: next.track, currentMs: durationOfSource(cur.track, cur.source), nextMs: durationOfSource(next.track, next.source) };
    return plannedCrossfadeMs(this.crossfadeMs, pair, albumKeyOf);
  }

  setCrossfade(durationMs: number): void {
    this.crossfadeMs = sanitizeCrossfadeMs(durationMs);
    if (this.fade === null) this.nextFadeMs = this.planFade();
  }

  pause(): void {
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.fade?.pause();
    this.current?.el.pause();
    if (this.current !== null) this.patch({ status: "paused", positionMs: this.current.el.currentTime * 1000 });
  }

  resume(): void {
    const slot = this.current;
    if (slot === null) return;
    if (this.fade !== null) return this.fade.resume();
    if (this.state.status === "ended") slot.el.currentTime = 0;
    void slot.el.play().catch(() => this.fail(slot));
  }

  stop(): void {
    this.clearAll();
    this.patch({ status: "idle", trackKey: null, positionMs: 0, durationMs: null, format: null });
  }

  seek(positionMs: number): void {
    if (this.current === null) return;
    this.swap?.cancel();
    this.swap = null;
    this.dropFade(true);
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.recovery.reset();
    this.current.el.currentTime = Math.max(0, positionMs) / 1000;
    this.patch({ positionMs: Math.max(0, positionMs) });
  }

  swapSource(trackKey: string, source: PlaybackSource): void {
    // Pendant un fondu, la bascule attend sa fin (`done`) : deux éléments suffisent à la fois.
    if (this.fade !== null && (trackKey === this.fade.from.track.key || trackKey === this.fade.to.track.key)) {
      this.overrides.set(trackKey, source);
      return;
    }
    if (this.next !== null && this.next.track.key === trackKey) return this.setNext(this.next.track, source);
    const from = this.current;
    if (from === null || from.track.key !== trackKey) {
      this.overrides.set(trackKey, source);
      return;
    }
    this.swap?.cancel();
    const to = this.slot(from.track, source);
    const latency = { get: () => this.swapLatencyMs, measured: (ms: number) => (this.swapLatencyMs = nextLatencyEstimate(this.swapLatencyMs, ms)) };
    this.swap = crossfadeSwap(from, to, this.deps, latency, () => (this.state.muted ? 0 : this.volumeFor(to)), (ready) => {
      this.swap = null;
      releaseSlot(from);
      this.adopt(ready);
      this.emitter.emit({ type: "swapped", trackKey, origin: source.origin });
    });
  }

  dispose(): void {
    this.clearAll();
    this.emitter.clear();
  }
}
