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
 */

import type {
  AudioEngineCapabilities, AudioEnginePort, AudioOutputDevice, EngineEvent, EngineState, MusicTrack, PlaybackSource, ReplayGainMode,
} from "@tentacle-tv/shared/music";
import { albumKeyOf, durationOfSource, EngineEmitter, idleState } from "../engineShared";
import { codecsFrom, effectiveGainMode, elementVolume, nextLatencyEstimate, nextStartDelayMs, sourceGainDb } from "./htmlRules";
import { makeSlot, releaseSlot, remainingS, whenReady, type MediaElementLike, type Slot } from "./htmlSlot";
import { crossfadeSwap, type SwapRun, type SwapTimers } from "./htmlSwap";

export interface HtmlEngineDeps extends SwapTimers {
  createElement: () => MediaElementLike;
  /** Chemin du serveur → adresse lisible par l'élément (`elementSourceUrl`). */
  resolveUrl: (url: string) => string;
  /** `use-credentials` quand la session est un cookie d'une autre origine. */
  credentials: string | null;
  canPlayType: (mime: string) => string;
  listOutputs?: () => Promise<AudioOutputDevice[]>;
}

/** Une position plus proche que cela de la dernière publiée ne se republie pas. */
const POSITION_STEP_MS = 100;

const positionOf = (slot: Slot): number => Math.round(slot.el.currentTime * 1000);

/** À moins de cela de la fin, le départ du suivant est programmé. */
const ARM_BEFORE_END_S = 1.5;

export class HtmlAudioEngine implements AudioEnginePort {
  readonly capabilities: AudioEngineCapabilities;
  private state: EngineState = idleState(1, false);
  private readonly emitter = new EngineEmitter();
  private current: Slot | null = null;
  private next: Slot | null = null;
  private draining: Slot | null = null;
  private swap: SwapRun | null = null;
  private advanceTimer: unknown = null;
  /** `play()` → rendu d'un élément PRÉCHARGÉ : ~10 ms (banc web) ; affinée à chaque départ. */
  private startLatencyMs = 10;
  /** Le même pour un élément tout juste PLACÉ (bascule) : plus lent, ~30 ms au départ. */
  private swapLatencyMs = 30;
  private gainMode: ReplayGainMode = "auto";
  private sinkId: string | null = null;
  private readonly overrides = new Map<string, PlaybackSource>();

  constructor(private readonly deps: HtmlEngineDeps) {
    this.capabilities = { engine: "html", gapless: false, exclusiveOutput: false, replayGain: true, codecs: codecsFrom(deps.canPlayType), hotSwap: true };
  }

  private patch(p: Partial<EngineState>): void {
    this.state = { ...this.state, ...p };
    this.emitter.emit({ type: "state", state: this.state });
  }

  private slot(track: MusicTrack, source: PlaybackSource): Slot {
    const el = this.deps.createElement();
    if (this.sinkId !== null) void el.setSinkId?.(this.sinkId).catch(() => undefined);
    return makeSlot(el, track, source, this.deps.resolveUrl(source.url), this.deps.credentials);
  }

  private volumeFor(slot: Slot | null): number {
    if (slot === null) return 0;
    const neighbours = [this.next?.track ?? null, this.current?.track ?? null].filter((t) => t !== null && t !== slot.track).map((t) => (t === null ? null : albumKeyOf(t)));
    const mode = effectiveGainMode(this.gainMode, albumKeyOf(slot.track), neighbours);
    return elementVolume(this.state.volume, sourceGainDb(mode, slot.source));
  }

  private applyVolumes(): void {
    for (const s of [this.current, this.next]) if (s !== null) {
      s.el.volume = this.volumeFor(s);
      s.el.muted = this.state.muted;
    }
  }

  /** Le courant : ses évènements pilotent l'état. */
  private adopt(slot: Slot): void {
    this.current = slot;
    slot.on("playing", () => this.current === slot && this.patch({ status: "playing", error: null, positionMs: positionOf(slot) }));
    slot.on("waiting", () => this.current === slot && this.patch({ status: "buffering" }));
    // Une pause qui ne vient pas de nous (le système, un casque débranché).
    slot.on("pause", () => this.current === slot && this.state.status === "playing" && this.patch({ status: "paused" }));
    slot.on("error", () => this.current === slot && this.fail(slot));
    slot.on("ended", () => this.current === slot && this.onEnded());
    slot.on("loadedmetadata", () => this.current === slot && Number.isFinite(slot.el.duration) && this.patch({ durationMs: Math.round(slot.el.duration * 1000) }));
    // La POSITION se publie au rythme de l'élément (~4 fois par seconde, comme le moteur du bureau) : sans elle,
    // le lecteur restait à « 0:00 » pendant que le son jouait (défaut R2-01 du 25/10).
    slot.on("timeupdate", () => {
      if (this.current !== slot) return;
      this.onTime(slot);
      this.publishPosition(slot);
    });
    slot.el.volume = this.volumeFor(slot);
    slot.el.muted = this.state.muted;
  }

  private publishPosition(slot: Slot): void {
    const positionMs = positionOf(slot);
    if (Math.abs(positionMs - this.state.positionMs) >= POSITION_STEP_MS) this.patch({ positionMs });
  }

  private fail(slot: Slot): void {
    this.patch({ status: "error", error: "media-error" });
    if (slot.source.origin === "plugin") this.emitter.emit({ type: "needSource", trackKey: slot.track.key });
  }

  private onTime(slot: Slot): void {
    const left = remainingS(slot);
    if (left === null || this.next === null || this.advanceTimer !== null || left > ARM_BEFORE_END_S || slot.el.paused) return;
    this.advanceTimer = this.deps.setTimeout(() => this.advance(), nextStartDelayMs(left, this.startLatencyMs));
  }

  private onEnded(): void {
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
    this.adopt(to);
    this.patch({ trackKey: to.track.key, positionMs: 0, durationMs: durationOfSource(to.track, to.source), format: to.source.format ?? to.track.format });
    this.emitter.emit({ type: "advanced", fromKey: from?.track.key ?? null, toKey: to.track.key });
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
    for (const s of [this.current, this.next, this.draining]) releaseSlot(s);
    this.current = this.next = this.draining = null;
  }

  play(track: MusicTrack, source: PlaybackSource, startMs = 0): void {
    this.clearAll();
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
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    releaseSlot(this.next);
    this.next = track !== null && source !== null ? this.slot(track, this.served(track, source)) : null;
    if (this.next !== null) this.next.el.load();
    this.applyVolumes();
  }

  pause(): void {
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.current?.el.pause();
    if (this.current !== null) this.patch({ status: "paused", positionMs: this.current.el.currentTime * 1000 });
  }

  resume(): void {
    const slot = this.current;
    if (slot === null) return;
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
    if (this.advanceTimer !== null) this.deps.clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
    this.current.el.currentTime = Math.max(0, positionMs) / 1000;
    this.patch({ positionMs: Math.max(0, positionMs) });
  }

  setVolume(volume: number): void {
    this.state = { ...this.state, volume: Math.min(1, Math.max(0, volume)) };
    this.applyVolumes();
    this.patch({});
  }

  setMuted(muted: boolean): void {
    this.state = { ...this.state, muted };
    this.applyVolumes();
    this.patch({});
  }

  setReplayGain(mode: ReplayGainMode): void {
    this.gainMode = mode;
    this.applyVolumes();
  }

  async listOutputs(): Promise<AudioOutputDevice[]> {
    return (await this.deps.listOutputs?.()) ?? [{ id: "default", name: "", exclusiveCapable: false }];
  }

  async setOutput(deviceId: string | null, exclusive: boolean): Promise<void> {
    if (exclusive) throw new Error("exclusive-unsupported");
    this.sinkId = deviceId;
    await Promise.all([this.current, this.next].map((s) => s?.el.setSinkId?.(deviceId ?? "") ?? Promise.resolve()));
    this.patch({ output: { deviceId, exclusive: false } });
  }

  swapSource(trackKey: string, source: PlaybackSource): void {
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

  getState(): EngineState {
    const slot = this.current;
    if (slot === null || this.state.status === "ended") return this.state;
    return { ...this.state, positionMs: Math.round(slot.el.currentTime * 1000) };
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  dispose(): void {
    this.clearAll();
    this.emitter.clear();
  }
}
