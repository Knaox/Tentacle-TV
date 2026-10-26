/**
 * La base du moteur `<audio>` (`htmlAudioEngine.ts`) : l'état publié, les cases (le courant, le suivant, celles
 * d'un fondu), leurs volumes (volume voulu, ReplayGain, sourdine) et la sortie. Le transport — lancer,
 * enchaîner, fondre, basculer — est dans la classe qui l'étend.
 */

import type {
  AudioEngineCapabilities, AudioOutputDevice, EngineEvent, EngineState, MusicTrack, PlaybackSource, ReplayGainMode,
} from "@tentacle-tv/shared/music";
import { albumKeyOf, EngineEmitter, idleState } from "../engineShared";
import { codecsFrom, effectiveGainMode, elementVolume, sourceGainDb } from "./htmlRules";
import { makeSlot, type MediaElementLike, type Slot } from "./htmlSlot";
import type { SwapTimers } from "./htmlSwap";
import type { CrossfadeRun } from "./htmlCrossfade";

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

export const positionOf = (slot: Slot): number => Math.round(slot.el.currentTime * 1000);

export abstract class HtmlEngineBase {
  readonly capabilities: AudioEngineCapabilities;
  protected state: EngineState = idleState(1, false);
  protected readonly emitter = new EngineEmitter();
  protected current: Slot | null = null;
  protected next: Slot | null = null;
  protected draining: Slot | null = null;
  protected fade: CrossfadeRun | null = null;
  protected gainMode: ReplayGainMode = "auto";
  protected sinkId: string | null = null;

  constructor(protected readonly deps: HtmlEngineDeps) {
    this.capabilities = { engine: "html", gapless: false, exclusiveOutput: false, replayGain: true, codecs: codecsFrom(deps.canPlayType), hotSwap: true };
  }

  protected abstract onTime(slot: Slot): void;
  protected abstract onEnded(): void;

  /** Les deux éléments d'un fondu en cours. */
  protected fadeSlots(): Slot[] {
    return this.fade === null ? [] : [this.fade.from, this.fade.to];
  }

  protected patch(p: Partial<EngineState>): void {
    this.state = { ...this.state, ...p };
    this.emitter.emit({ type: "state", state: this.state });
  }

  protected slot(track: MusicTrack, source: PlaybackSource): Slot {
    const el = this.deps.createElement();
    if (this.sinkId !== null) void el.setSinkId?.(this.sinkId).catch(() => undefined);
    return makeSlot(el, track, source, this.deps.resolveUrl(source.url), this.deps.credentials);
  }

  protected volumeFor(slot: Slot | null): number {
    if (slot === null) return 0;
    const neighbours = [this.next?.track ?? null, this.current?.track ?? null].filter((t) => t !== null && t !== slot.track).map((t) => (t === null ? null : albumKeyOf(t)));
    const mode = effectiveGainMode(this.gainMode, albumKeyOf(slot.track), neighbours);
    return elementVolume(this.state.volume, sourceGainDb(mode, slot.source));
  }

  protected applyVolumes(): void {
    for (const s of [this.current, this.next, ...this.fadeSlots()]) if (s !== null) {
      s.el.volume = this.volumeFor(s);
      s.el.muted = this.state.muted;
    }
    this.fade?.apply();
  }

  /** Le courant : ses évènements pilotent l'état. */
  protected adopt(slot: Slot, setVolume = true): void {
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
    if (setVolume) slot.el.volume = this.volumeFor(slot);
    slot.el.muted = this.state.muted;
  }

  protected publishPosition(slot: Slot): void {
    const positionMs = positionOf(slot);
    if (Math.abs(positionMs - this.state.positionMs) >= POSITION_STEP_MS) this.patch({ positionMs });
  }

  protected fail(slot: Slot): void {
    this.patch({ status: "error", error: "media-error" });
    if (slot.source.origin === "plugin") this.emitter.emit({ type: "needSource", trackKey: slot.track.key });
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
    await Promise.all([this.current, this.next, ...this.fadeSlots()].map((s) => s?.el.setSinkId?.(deviceId ?? "") ?? Promise.resolve()));
    this.patch({ output: { deviceId, exclusive: false } });
  }

  getState(): EngineState {
    const slot = this.current;
    if (slot === null || this.state.status === "ended") return this.state;
    return { ...this.state, positionMs: Math.round(slot.el.currentTime * 1000) };
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }
}
