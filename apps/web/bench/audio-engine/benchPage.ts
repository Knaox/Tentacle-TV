/**
 * La page du banc du moteur `<audio>` (bundlée par `run.mjs`, servie de la même
 * origine que le son). Chaque élément créé par le moteur passe par
 * `createMediaElementSource` vers un enregistreur (AudioWorklet) : on lit ce
 * que les éléments SORTENT, horodaté sur l'horloge du contexte, ramenée à
 * `performance.now()` par `getOutputTimestamp()` (latence de sortie comprise).
 */

import type { EngineEvent, MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { HtmlAudioEngine } from "../../src/music/engine/html/htmlAudioEngine";
import type { MediaElementLike } from "../../src/music/engine/html/htmlSlot";

const RECORDER = `
class Recorder extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(8192); this.n = 0; this.first = -1; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      if (this.first < 0) this.first = currentFrame;
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage({ frame: currentFrame + i + 1 - this.n, data: this.buf }); this.buf = new Float32Array(8192); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("recorder", Recorder);`;

const ctx = new AudioContext({ latencyHint: "interactive" });
const chunks: Array<{ frame: number; data: Float32Array }> = [];
let recorder: AudioWorkletNode | null = null;
const events: Array<{ at: number; event: EngineEvent }> = [];

async function setup(): Promise<void> {
  const url = URL.createObjectURL(new Blob([RECORDER], { type: "application/javascript" }));
  await ctx.audioWorklet.addModule(url);
  recorder = new AudioWorkletNode(ctx, "recorder", { numberOfInputs: 1, numberOfOutputs: 1 });
  recorder.port.onmessage = (e: MessageEvent<{ frame: number; data: Float32Array }>) => chunks.push(e.data);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  recorder.connect(silent).connect(ctx.destination);
  await ctx.resume();
}

const engine = new HtmlAudioEngine({
  createElement: () => {
    const el = document.createElement("audio");
    // Même origine : pas de `crossOrigin`, et le graphe reçoit le vrai son.
    if (recorder !== null) ctx.createMediaElementSource(el).connect(recorder);
    return el as MediaElementLike;
  },
  resolveUrl: (url) => `${url}${url.includes("?") ? "&" : "?"}api_key=bench`,
  credentials: null,
  canPlayType: (mime) => document.createElement("audio").canPlayType(mime),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
  now: () => performance.now(),
});
engine.subscribe((event) => events.push({ at: performance.now(), event }));

function track(key: string, durationMs: number | null): MusicTrack {
  return {
    key, jellyfinId: key, external: null, title: key, artists: [], album: { title: "Banc", mbid: null, jellyfinId: "banc" },
    durationMs, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library", format: null, favorite: false,
  };
}

function source(url: string, origin: "library" | "plugin" = "library", complete = true): PlaybackSource {
  return { trackKey: url, url, origin, complete, sizeBytes: null, durationMs: null, format: null, replayGain: null, expiresAt: null };
}

/** Instant (performance.now) où la trame `frame` du contexte SORT, d'après le contexte. */
function frameToPerf(frame: number): number {
  const ts = ctx.getOutputTimestamp();
  return (ts.performanceTime ?? performance.now()) + (frame / ctx.sampleRate - (ts.contextTime ?? ctx.currentTime)) * 1000;
}

function firstLoudFrame(since: number): number | null {
  for (const c of chunks) {
    if (c.frame + c.data.length < since) continue;
    for (let i = 0; i < c.data.length; i++) if (c.frame + i >= since && Math.abs(c.data[i] ?? 0) > 0.01) return c.frame + i;
  }
  return null;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (pred: () => boolean, ms: number) => {
  const t0 = performance.now();
  while (!pred() && performance.now() - t0 < ms) await wait(5);
};

async function latency(runs: number) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    engine.stop();
    await wait(400);
    const startFrame = Math.round(ctx.currentTime * ctx.sampleRate);
    const t0 = performance.now();
    engine.play(track(`l${i}`, 3000), source(`/files/onset.flac?k=${i}`));
    await until(() => firstLoudFrame(startFrame) !== null, 3000);
    const f = firstLoudFrame(startFrame);
    const playing = events.find((e) => e.at >= t0 && e.event.type === "state" && e.event.state.status === "playing");
    out.push({ firstAudibleMs: f === null ? null : Math.round(frameToPerf(f) - t0), playingEventMs: playing ? Math.round(playing.at - t0) : null });
  }
  engine.stop();
  return { outputLatencyMs: Math.round((ctx.outputLatency ?? 0) * 1000), baseLatencyMs: Math.round(ctx.baseLatency * 1000), runs: out };
}

function recording(fromFrame: number) {
  const kept = chunks.filter((c) => c.frame + c.data.length > fromFrame);
  const start = kept[0]?.frame ?? fromFrame;
  const total = kept.reduce((n, c) => n + c.data.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of kept) { all.set(c.data, o); o += c.data.length; }
  const bytes = new Uint8Array(all.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { sampleRate: ctx.sampleRate, startFrame: start, pcm: btoa(bin) };
}

async function album() {
  const from = Math.round(ctx.currentTime * ctx.sampleRate);
  engine.play(track("t1", 4000), source("/files/album-1.flac"));
  engine.setNext(track("t2", 4002), source("/files/album-2.flac"));
  await until(() => events.some((e) => e.event.type === "advanced"), 10_000);
  engine.setNext(track("t3", 3999), source("/files/album-3.flac"));
  await until(() => engine.getState().status === "ended", 20_000);
  await wait(300);
  return { advanced: events.filter((e) => e.event.type === "advanced").length, ...recording(from) };
}

async function swap() {
  const from = Math.round(ctx.currentTime * ctx.sampleRate);
  engine.play(track("t1", 4000), source("/grow/album-1.flac?mode=hold&rate=266000&head=150000&key=web-swap", "plugin", false));
  await until(() => engine.getState().status === "playing", 10_000);
  await wait(400);
  const asked = performance.now();
  engine.swapSource("t1", source("/files/album-1.flac"));
  await until(() => events.some((e) => e.event.type === "swapped"), 10_000);
  const swappedAt = events.find((e) => e.event.type === "swapped")?.at ?? null;
  await wait(800);
  engine.stop();
  // Les instants clés, sur la même échelle que l'enregistrement (ms depuis son début).
  const recStartPerf = frameToPerf(from);
  const rel = (t: number | null | undefined) => (t == null ? null : Math.round(t - recStartPerf));
  const buffering = events.filter((e) => e.at >= recStartPerf && e.event.type === "state" && e.event.state.status === "buffering").map((e) => rel(e.at));
  return { swappedAfterMs: swappedAt === null ? null : Math.round(swappedAt - asked), askedAtRecMs: rel(asked), swappedAtRecMs: rel(swappedAt), bufferingAtRecMs: buffering, ...recording(from) };
}

declare global {
  interface Window {
    bench: { setup: () => Promise<void>; latency: (n: number) => Promise<unknown>; album: () => Promise<unknown>; swap: () => Promise<unknown>; capabilities: () => unknown };
  }
}
window.bench = { setup, latency, album, swap, capabilities: () => engine.capabilities };
