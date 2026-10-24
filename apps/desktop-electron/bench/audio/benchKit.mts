/**
 * Les outils communs des scénarios du banc audio : un moteur NATIF réel
 * (`NativeAudioEngine`, la vraie libmpv par koffi, sous Node — sans Electron,
 * sans fenêtre), ses évènements enregistrés, des titres et des sources.
 */

import { NativeAudioEngine, type EngineConfig } from "../../src/main/audio/audioEngine.ts";
import type {
  AudioBridgeEvent,
  AudioBridgeSource,
  AudioBridgeStart,
  AudioBridgeState,
  AudioBridgeTrack,
} from "../../src/main/audio/audioBridgeContract.ts";

export const PORT = 3102;
export const ORIGIN = `http://127.0.0.1:${PORT}`;

export interface Recorded {
  at: number;
  event: AudioBridgeEvent;
}

export interface BenchEngine {
  engine: NativeAudioEngine;
  events: Recorded[];
  last: () => AudioBridgeState | null;
  /** Attend un évènement ; `after` : en relisant aussi ceux déjà reçus depuis cet instant. */
  waitFor: (pred: (e: AudioBridgeEvent) => boolean, timeoutMs?: number, after?: number) => Promise<Recorded>;
}

export async function benchEngine(config: Partial<EngineConfig> = {}, volume = 1, start: Partial<AudioBridgeStart> = {}): Promise<BenchEngine> {
  const events: Recorded[] = [];
  const waiters: Array<{ pred: (e: AudioBridgeEvent) => boolean; resolve: (r: Recorded) => void }> = [];
  // `BENCH_MPVLOG=<fichier>` : le journal verbeux de mpv, pour comprendre un scénario.
  const log = process.env["BENCH_MPVLOG"];
  const extraOptions = { ...config.extraOptions, ...(log ? { "log-file": log, "msg-level": "all=v" } : {}) };
  const engine = new NativeAudioEngine({ platform: "darwin", ...config, extraOptions }, (event) => {
    const rec = { at: performance.now(), event };
    events.push(rec);
    if (process.env["BENCH_DEBUG"]) console.log(Math.round(rec.at), JSON.stringify(event).slice(0, 220));
    for (const w of [...waiters]) {
      if (w.pred(event)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(rec);
      }
    }
  });
  await engine.start({
    serverOrigin: ORIGIN,
    headers: { "X-Emby-Token": "bench" },
    volume,
    muted: false,
    replayGain: "off",
    deviceId: null,
    exclusive: false,
    ...start,
  });
  return {
    engine,
    events,
    last: () => {
      for (let i = events.length - 1; i >= 0; i -= 1) {
        const e = events[i]?.event;
        if (e?.type === "state") return e.state;
      }
      return null;
    },
    waitFor: (pred, timeoutMs = 30_000, after = Infinity) =>
      new Promise((resolve, reject) => {
        const seen = events.find((r) => r.at >= after && pred(r.event));
        if (seen !== undefined) return resolve(seen);
        const timer = setTimeout(() => reject(new Error("délai dépassé")), timeoutMs);
        waiters.push({ pred, resolve: (r) => { clearTimeout(timer); resolve(r); } });
      }),
  };
}

/** La sortie PCM du banc : untimed, s16 stéréo, dans un fichier. */
export function pcmOutput(file: string): Record<string, string> {
  return { ao: "pcm", "ao-pcm-file": file, "ao-pcm-waveheader": "no", "audio-format": "s16", "audio-channels": "stereo" };
}

export function track(key: string, durationMs: number | null = null, albumKey: string | null = "banc"): AudioBridgeTrack {
  return { trackKey: key, albumKey, durationMs, format: null };
}

/**
 * Le témoin (glissandos + bruit) pèse ~140 ko/s en FLAC : les débits du banc
 * s'expriment en multiples de ce TEMPS RÉEL.
 */
export const REALTIME_BPS = 140_000;
export const rate = (times: number): number => Math.round(REALTIME_BPS * times);

/** Débit des fichiers « bibliothèque » en sortie PCM : ~6× le temps réel. */
export const PACE = `rate=${rate(6)}`;

export function library(path: string, durationMs: number | null = null, query = PACE): AudioBridgeSource {
  return { url: `${ORIGIN}/files/${path}${query === "" ? "" : `?${query}`}`, origin: "library", complete: true, sizeBytes: null, durationMs, replayGain: null, expiresAt: null };
}

export function growing(path: string, query: string, durationMs: number | null): AudioBridgeSource {
  return { url: `${ORIGIN}/grow/${path}?${query}`, origin: "plugin", complete: false, sizeBytes: null, durationMs, replayGain: null, expiresAt: null };
}

export const ended = (e: AudioBridgeEvent): boolean => e.type === "state" && e.state.status === "ended";
export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Arrête l'instance (la sortie PCM est vidée dans son fichier). */
export async function close(b: BenchEngine): Promise<void> {
  await b.engine.dispose();
}
