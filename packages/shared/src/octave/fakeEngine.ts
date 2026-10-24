/**
 * Octave — un moteur FACTICE conforme à `AudioEnginePort` : il note chaque
 * appel et laisse le test (ou une scène de banc) dire ce que le son fait.
 * Jamais livré comme moteur : le vrai est celui de l'agent 2
 * (`apps/web/src/music/engine/`), branché par `engine/octaveEngine.ts`.
 */

import type {
  AudioEngineCapabilities,
  AudioEnginePort,
  EngineEvent,
  EngineState,
  MusicTrack,
  PlaybackSource,
} from "../music";

export type EngineCall =
  | { method: "play"; key: string; url: string; startMs: number }
  | { method: "setNext"; key: string | null }
  | { method: "swapSource"; key: string; url: string }
  | { method: "pause" | "resume" | "stop" }
  | { method: "seek"; positionMs: number };

const CAPABILITIES: AudioEngineCapabilities = {
  engine: "html",
  gapless: true,
  exclusiveOutput: false,
  replayGain: false,
  codecs: ["flac", "alac", "opus", "aac", "mp3", "wav"],
  hotSwap: true,
};

export interface FakeEngine extends AudioEnginePort {
  calls: EngineCall[];
  emit(event: EngineEvent): void;
  /** Le son a démarré (ou avancé) : un état `playing` pour le titre courant. */
  sound(positionMs?: number): void;
  /** Avance le temps simulé (scènes de banc) : relance `sound` toutes les 250 ms. */
  simulate(on: boolean): void;
}

export function createFakeEngine(): FakeEngine {
  const listeners = new Set<(event: EngineEvent) => void>();
  let state: EngineState = {
    status: "idle",
    trackKey: null,
    positionMs: 0,
    durationMs: null,
    volume: 1,
    muted: false,
    format: null,
    output: { deviceId: null, exclusive: false },
    error: null,
  };
  let next: MusicTrack | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const calls: EngineCall[] = [];

  const setState = (patch: Partial<EngineState>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l({ type: "state", state });
  };

  const engine: FakeEngine = {
    capabilities: CAPABILITIES,
    calls,
    play(track: MusicTrack, source: PlaybackSource, startMs = 0) {
      calls.push({ method: "play", key: track.key, url: source.url, startMs });
      setState({ status: "loading", trackKey: track.key, positionMs: startMs, durationMs: source.durationMs ?? track.durationMs, format: source.format });
    },
    setNext(track) {
      next = track;
      calls.push({ method: "setNext", key: track?.key ?? null });
    },
    pause() {
      calls.push({ method: "pause" });
      if (state.trackKey) setState({ status: "paused" });
    },
    resume() {
      calls.push({ method: "resume" });
      if (state.trackKey) setState({ status: "playing" });
    },
    stop() {
      calls.push({ method: "stop" });
      setState({ status: "idle", trackKey: null, positionMs: 0 });
    },
    seek(positionMs) {
      calls.push({ method: "seek", positionMs });
      setState({ positionMs });
    },
    setVolume(volume) {
      setState({ volume });
    },
    setMuted(muted) {
      setState({ muted });
    },
    setReplayGain() {},
    listOutputs: async () => [],
    setOutput: async () => {},
    swapSource(trackKey, source) {
      calls.push({ method: "swapSource", key: trackKey, url: source.url });
      for (const l of listeners) l({ type: "swapped", trackKey, origin: source.origin });
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (timer) clearInterval(timer);
      listeners.clear();
    },
    emit(event) {
      for (const l of listeners) l(event);
    },
    sound(positionMs) {
      setState({ status: "playing", positionMs: positionMs ?? state.positionMs });
    },
    simulate(on) {
      if (timer) clearInterval(timer);
      timer = null;
      if (!on) return;
      timer = setInterval(() => {
        if (state.status === "loading") setState({ status: "playing" });
        if (state.status !== "playing") return;
        const position = state.positionMs + 250;
        if (state.durationMs !== null && position >= state.durationMs) {
          const from = state.trackKey;
          const to = next?.key ?? null;
          next = null;
          if (to) {
            for (const l of listeners) l({ type: "advanced", fromKey: from, toKey: to });
            setState({ trackKey: to, positionMs: 0 });
          } else setState({ status: "ended", positionMs: state.durationMs });
          return;
        }
        setState({ positionMs: position });
      }, 250);
    },
  };
  return engine;
}
