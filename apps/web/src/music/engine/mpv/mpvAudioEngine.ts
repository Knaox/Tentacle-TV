/**
 * Le port `AudioEnginePort` sur le moteur NATIF du bureau (mpv en audio seul,
 * `apps/desktop-electron/src/main/audio/`). Ici, rien ne décide : la file mpv,
 * l'enchaînement sans blanc, la bascule à l'instant T vivent dans le processus
 * principal ; la page traduit, et tient l'état visible.
 *
 * « La barre se met à jour AVANT le son » : `play` pose aussitôt l'état
 * (titre, position de départ, durée, format annoncé), puis envoie la commande.
 * Entre deux états du principal (quatre par seconde), `getState` extrapole la
 * position depuis l'instant de la mesure (`at`).
 */

import type {
  AudioEngineCapabilities,
  AudioEnginePort,
  AudioOutputDevice,
  EngineEvent,
  EngineState,
  MusicTrack,
  PlaybackSource,
  ReplayGainMode,
} from "@tentacle-tv/shared/music";
import { AUDIO_BRIDGE_EVENT, type AudioBridgeEvent, type AudioBridgeSource, type AudioBridgeTrack } from "./audioBridgeContract";
import {
  absoluteSourceUrl,
  albumKeyOf,
  durationOfSource,
  EngineEmitter,
  engineHeaders,
  extrapolatedPosition,
  idleState,
  type MusicEngineAuth,
} from "../engineShared";

/** Le pont de la coquille (`desktop/bridge.ts`), injecté pour les tests. */
export interface NativeBridge {
  invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  listen: <T>(event: string, handler: (e: { payload: T }) => void) => Promise<() => void>;
}

export interface EnginePrefs {
  volume: number;
  muted: boolean;
  replayGain: ReplayGainMode;
  deviceId: string | null;
  exclusive: boolean;
}

export function bridgeTrack(track: MusicTrack, source: PlaybackSource): AudioBridgeTrack {
  return { trackKey: track.key, albumKey: albumKeyOf(track), durationMs: durationOfSource(track, source), format: source.format ?? track.format };
}

export function bridgeSource(source: PlaybackSource, baseUrl: string): AudioBridgeSource {
  return {
    url: absoluteSourceUrl(source.url, baseUrl),
    origin: source.origin,
    complete: source.complete,
    sizeBytes: source.sizeBytes,
    durationMs: source.durationMs,
    replayGain: source.replayGain,
    expiresAt: source.expiresAt,
    // Un flux que CET appareil lit en direct (requêtes déléguées) : la coquille le juge et garde `url` en repli.
    ...(source.direct ? { direct: source.direct } : {}),
    // La copie gardée hors ligne : la coquille la cherche dans SA base, `url` reste le repli.
    ...(source.kept ? { kept: source.kept } : {}),
  };
}

class MpvAudioEngine implements AudioEnginePort {
  private state: EngineState;
  private measuredAt = Date.now();
  private readonly emitter = new EngineEmitter();
  private unlisten: (() => void) | null = null;
  private disposed = false;

  constructor(
    readonly capabilities: AudioEngineCapabilities,
    private readonly bridge: NativeBridge,
    private readonly auth: MusicEngineAuth,
    prefs: EnginePrefs,
  ) {
    this.state = { ...idleState(prefs.volume, prefs.muted), output: { deviceId: prefs.deviceId, exclusive: prefs.exclusive } };
  }

  /** Faux : un démarrage plus récent a été demandé — l'instance native est à lui, pas à ce port. */
  ownsNative: () => boolean = () => true;

  attach(unlisten: () => void): void {
    this.unlisten = unlisten;
  }

  handle(event: AudioBridgeEvent): void {
    if (this.disposed) return;
    if (event.type === "state") {
      this.state = event.state;
      this.measuredAt = event.at;
      this.emitter.emit({ type: "state", state: event.state });
      return;
    }
    this.emitter.emit(event);
  }

  private call(command: string, args: Record<string, unknown> = {}): void {
    void this.bridge.invoke(command, args).catch((error: unknown) => {
      this.setState({ status: "error", error: `bridge: ${String(error)}` });
    });
  }

  private setState(patch: Partial<EngineState>): void {
    this.state = { ...this.state, ...patch };
    this.measuredAt = Date.now();
    this.emitter.emit({ type: "state", state: this.state });
  }

  play(track: MusicTrack, source: PlaybackSource, startMs = 0): void {
    this.setState({
      status: "loading",
      trackKey: track.key,
      positionMs: startMs,
      durationMs: durationOfSource(track, source),
      format: source.format ?? track.format,
      error: null,
    });
    this.call("audio_play", { track: bridgeTrack(track, source), source: bridgeSource(source, this.auth.baseUrl), startMs });
  }

  setNext(track: MusicTrack | null, source: PlaybackSource | null): void {
    const both = track !== null && source !== null;
    this.call("audio_set_next", {
      track: both ? bridgeTrack(track, source) : null,
      source: both ? bridgeSource(source, this.auth.baseUrl) : null,
    });
  }

  pause(): void {
    if (this.state.status === "playing") this.setState({ status: "paused", positionMs: this.getState().positionMs });
    this.call("audio_control", { action: "pause" });
  }

  resume(): void {
    this.call("audio_control", { action: "resume" });
  }

  stop(): void {
    this.setState({ status: "idle", trackKey: null, positionMs: 0, durationMs: null, format: null });
    this.call("audio_control", { action: "stop" });
  }

  seek(positionMs: number): void {
    this.setState({ positionMs: Math.max(0, positionMs) });
    this.call("audio_control", { action: "seek", value: Math.max(0, positionMs) });
  }

  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    this.setState({ volume: v });
    this.call("audio_control", { action: "volume", value: v });
  }

  setMuted(muted: boolean): void {
    this.setState({ muted });
    this.call("audio_control", { action: "muted", value: muted });
  }

  setReplayGain(mode: ReplayGainMode): void {
    this.call("audio_control", { action: "replayGain", mode });
  }

  listOutputs(): Promise<AudioOutputDevice[]> {
    return this.bridge.invoke<AudioOutputDevice[]>("audio_list_outputs");
  }

  setOutput(deviceId: string | null, exclusive: boolean): Promise<void> {
    return this.bridge.invoke<void>("audio_set_output", { deviceId, exclusive });
  }

  swapSource(trackKey: string, source: PlaybackSource): void {
    this.call("audio_swap_source", { trackKey, source: bridgeSource(source, this.auth.baseUrl) });
  }

  getState(): EngineState {
    return { ...this.state, positionMs: extrapolatedPosition(this.state, this.measuredAt, Date.now()) };
  }

  subscribe(listener: (event: EngineEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unlisten?.();
    this.emitter.clear();
    // Le principal n'a qu'UN moteur : l'arrêt tardif d'un port quitté (son démarrage a fini après
    // la sortie) couperait celui d'une entrée plus récente — seul le dernier démarré l'arrête.
    if (this.ownsNative()) void this.bridge.invoke("audio_engine_stop").catch(() => undefined);
  }
}

/** Les démarrages demandés, dans l'ordre : le dernier possède l'instance native du principal. */
let startGeneration = 0;

/** Démarre le moteur natif (instance mpv gardée chaude) et rend le port. */
export async function createMpvAudioEngine(bridge: NativeBridge, auth: MusicEngineAuth, prefs: EnginePrefs): Promise<AudioEnginePort> {
  const generation = ++startGeneration;
  let engine: MpvAudioEngine | null = null;
  const early: AudioBridgeEvent[] = [];
  const unlisten = await bridge.listen<AudioBridgeEvent>(AUDIO_BRIDGE_EVENT, ({ payload }) => {
    if (engine === null) early.push(payload);
    else engine.handle(payload);
  });
  try {
    const capabilities = await bridge.invoke<AudioEngineCapabilities>("audio_engine_start", {
      serverOrigin: new URL(auth.baseUrl).origin,
      headers: engineHeaders(auth),
      ...prefs,
    });
    engine = new MpvAudioEngine(capabilities, bridge, auth, prefs);
    engine.ownsNative = () => generation === startGeneration;
    engine.attach(unlisten);
    for (const e of early) engine.handle(e);
    return engine;
  } catch (error) {
    unlisten();
    throw error;
  }
}
