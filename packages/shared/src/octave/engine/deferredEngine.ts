/**
 * Le moteur DIFFÉRÉ : un `AudioEnginePort` rendu tout de suite, devant le vrai
 * moteur qui démarre (mpv : ~600 ms au bureau). La coquille d'Octave se peint
 * donc dès la première image ; le lecteur s'y raccroche, et ses ordres
 * attendent le vrai moteur.
 *
 * Pendant l'attente :
 * - les ordres sont gardés puis rejoués DANS L'ORDRE ; seuls le dernier
 *   `play` et le dernier `seek` comptent quand ils se suivent — jamais deux
 *   titres joués l'un après l'autre au démarrage ;
 * - l'état dit la vérité : un titre demandé est « loading » (le lecteur reste
 *   en « starting », Pause affiché, position immobile), jamais « playing » ;
 * - un échec du démarrage passe en « error » (le lecteur dit son erreur de
 *   moteur), sans aucun ordre resté en file ;
 * - `dispose()` vide la file et arrête le vrai moteur dès qu'il arrive.
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
} from "../../music";
import type { EnginePrefs } from "./bridgeAudioEngine";

type Order =
  | { kind: "play"; track: MusicTrack; source: PlaybackSource; startMs: number }
  | { kind: "seek"; positionMs: number }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "stop" }
  | { kind: "setNext"; track: MusicTrack | null; source: PlaybackSource | null }
  | { kind: "swapSource"; trackKey: string; source: PlaybackSource };

/** Ce que le moteur ne sait pas encore dire : rien de plus que le strict nécessaire. */
const PENDING_CAPABILITIES: AudioEngineCapabilities = { engine: "html", gapless: false, exclusiveOutput: false, replayGain: false, codecs: [], hotSwap: false };

/** Range un ordre dans la file : seuls les DERNIERS `play` / `seek` qui se suivent comptent. */
export function enqueueOrder(queue: Order[], order: Order): Order[] {
  const last = queue.at(-1);
  switch (order.kind) {
    // Un nouveau titre efface tout le transport d'avant : il repart de lui.
    case "play":
      return [order];
    case "stop":
      return [order];
    case "seek":
      if (last?.kind === "play") return [...queue.slice(0, -1), { ...last, startMs: order.positionMs }];
      if (last?.kind === "seek") return [...queue.slice(0, -1), order];
      return [...queue, order];
    case "pause":
    case "resume":
      if (last?.kind === "pause" || last?.kind === "resume") return [...queue.slice(0, -1), order];
      return [...queue, order];
    case "setNext":
      return [...queue.filter((o) => o.kind !== "setNext"), order];
    case "swapSource": {
      const played = queue.findIndex((o) => o.kind === "play" && o.track.key === order.trackKey);
      if (played >= 0) return queue.map((o, i) => (i === played && o.kind === "play" ? { ...o, source: order.source } : o));
      return [...queue.filter((o) => !(o.kind === "swapSource" && o.trackKey === order.trackKey)), order];
    }
  }
}

function replay(engine: AudioEnginePort, order: Order): void {
  if (order.kind === "play") engine.play(order.track, order.source, order.startMs);
  else if (order.kind === "seek") engine.seek(order.positionMs);
  else if (order.kind === "pause") engine.pause();
  else if (order.kind === "resume") engine.resume();
  else if (order.kind === "stop") engine.stop();
  else if (order.kind === "setNext") engine.setNext(order.track, order.source);
  else engine.swapSource(order.trackKey, order.source);
}

export interface DeferredEngine extends AudioEnginePort {
  /** Le vrai moteur a pris la main (pour les tests et le banc). */
  readonly ready: boolean;
}

export function createDeferredEngine(start: Promise<AudioEnginePort>, prefs: EnginePrefs): DeferredEngine {
  let real: AudioEnginePort | null = null;
  let failed = false;
  let disposed = false;
  let queue: Order[] = [];
  const settings: { volume?: number; muted?: boolean; replayGain?: ReplayGainMode; crossfadeMs?: number } = {};
  const waiters: Array<() => void> = [];
  const listeners = new Set<(event: EngineEvent) => void>();
  let unsubscribeReal: (() => void) | null = null;
  let state: EngineState = {
    status: "idle",
    trackKey: null,
    positionMs: 0,
    durationMs: null,
    volume: prefs.volume,
    muted: prefs.muted,
    format: null,
    output: { deviceId: prefs.deviceId, exclusive: prefs.exclusive },
    error: null,
  };

  const emit = (event: EngineEvent) => {
    for (const listener of listeners) listener(event);
  };
  const setState = (patch: Partial<EngineState>) => {
    state = { ...state, ...patch };
    emit({ type: "state", state });
  };
  const settle = () => {
    for (const wake of waiters.splice(0)) wake();
  };

  start.then(
    (engine) => {
      if (disposed) return engine.dispose();
      if (settings.volume !== undefined) engine.setVolume(settings.volume);
      if (settings.muted !== undefined) engine.setMuted(settings.muted);
      if (settings.replayGain !== undefined) engine.setReplayGain(settings.replayGain);
      if (settings.crossfadeMs !== undefined) engine.setCrossfade?.(settings.crossfadeMs);
      const orders = queue;
      queue = [];
      real = engine;
      unsubscribeReal = engine.subscribe(emit);
      for (const order of orders) replay(engine, order);
      settle();
      // Le vrai état prend la place du nôtre (même sans ordre : volume, sortie…).
      emit({ type: "state", state: engine.getState() });
    },
    (error: unknown) => {
      if (disposed) return;
      failed = true;
      queue = [];
      settle();
      console.warn("[music-engine] le moteur n'a pas démarré", error);
      setState({ status: "error", error: error instanceof Error ? error.message : "engine start failed" });
    },
  );

  /** L'ordre part au vrai moteur s'il est là, sinon en file (rien après un échec ou une sortie). */
  const order = (o: Order, local: () => void) => {
    if (real) return replay(real, o);
    if (failed || disposed) return;
    queue = enqueueOrder(queue, o);
    local();
  };
  const whenStarted = () => new Promise<void>((resolve) => (real || failed || disposed ? resolve() : waiters.push(resolve)));

  return {
    get ready() {
      return real !== null;
    },
    get capabilities() {
      return real?.capabilities ?? PENDING_CAPABILITIES;
    },
    play(track, source, startMs = 0) {
      // Après un échec : le lecteur l'apprend pour CE titre, comme d'un moteur qui refuse.
      if (failed && !real) return setState({ status: "error", trackKey: track.key, positionMs: startMs });
      order({ kind: "play", track, source, startMs }, () =>
        setState({ status: "loading", trackKey: track.key, positionMs: startMs, durationMs: source.durationMs ?? track.durationMs, format: null, error: null }),
      );
    },
    setNext(track, source) {
      order({ kind: "setNext", track, source }, () => undefined);
    },
    pause() {
      order({ kind: "pause" }, () => {
        if (state.trackKey !== null) setState({ status: "paused" });
      });
    },
    resume() {
      // Aucun son avant le vrai moteur : la reprise attend, elle ne « joue » pas.
      order({ kind: "resume" }, () => {
        if (state.trackKey !== null) setState({ status: "loading" });
      });
    },
    stop() {
      order({ kind: "stop" }, () => setState({ status: "idle", trackKey: null, positionMs: 0, durationMs: null }));
    },
    seek(positionMs) {
      order({ kind: "seek", positionMs }, () => {
        if (state.trackKey !== null) setState({ positionMs });
      });
    },
    setVolume(volume) {
      if (real) return real.setVolume(volume);
      settings.volume = volume;
      setState({ volume });
    },
    setMuted(muted) {
      if (real) return real.setMuted(muted);
      settings.muted = muted;
      setState({ muted });
    },
    setReplayGain(mode) {
      if (real) return real.setReplayGain(mode);
      settings.replayGain = mode;
    },
    setCrossfade(durationMs) {
      if (real) return real.setCrossfade?.(durationMs);
      settings.crossfadeMs = durationMs;
    },
    async listOutputs(): Promise<AudioOutputDevice[]> {
      await whenStarted();
      return real ? real.listOutputs() : [];
    },
    async setOutput(deviceId, exclusive) {
      await whenStarted();
      if (real) await real.setOutput(deviceId, exclusive);
    },
    swapSource(trackKey, source) {
      order({ kind: "swapSource", trackKey, source }, () => undefined);
    },
    getState: () => real?.getState() ?? state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      queue = [];
      listeners.clear();
      settle();
      unsubscribeReal?.();
      real?.dispose();
      real = null;
    },
  };
}
