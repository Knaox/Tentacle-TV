/**
 * La page du banc de la TRANSITION DOUCE du moteur `<audio>` (bundlée par `crossfade.mjs`) : chaque élément
 * créé par le moteur passe par `createMediaElementSource` vers UN enregistreur (AudioWorklet) — on enregistre
 * le MÉLANGE que l'auditeur entendrait, volumes des éléments compris. Deux tons purs (440 et 660 Hz, même
 * niveau) : l'analyse sépare chaque titre dans le mélange et lit son gain au fil du fondu.
 */

import type { EngineEvent, MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { HtmlAudioEngine } from "../../src/music/engine/html/htmlAudioEngine";
import type { MediaElementLike } from "../../src/music/engine/html/htmlSlot";

const RECORDER = `
class Recorder extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(8192); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    const len = ch ? ch.length : 128;
    for (let i = 0; i < len; i++) {
      this.buf[this.n++] = ch ? ch[i] : 0;
      if (this.n === this.buf.length) { this.port.postMessage({ frame: currentFrame + i + 1 - this.n, data: this.buf }); this.buf = new Float32Array(8192); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("recorder", Recorder);`;

const ctx = new AudioContext({ latencyHint: "interactive" });
const chunks: Array<{ frame: number; data: Float32Array }> = [];
let recorder: AudioWorkletNode | null = null;
const events: Array<{ at: number; frame: number; event: EngineEvent }> = [];

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
engine.subscribe((event) => events.push({ at: performance.now(), frame: Math.round(ctx.currentTime * ctx.sampleRate), event }));

function track(key: string, album: string, trackNumber: number, durationMs: number): MusicTrack {
  return {
    key, jellyfinId: key, external: null, title: key, artists: [], album: { title: album, mbid: null, jellyfinId: album },
    durationMs, trackNumber, discNumber: 1, year: null, artworkUrl: null,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "library", format: null, favorite: false,
  };
}

function source(url: string): PlaybackSource {
  return { trackKey: url, url, origin: "library", complete: true, sizeBytes: null, durationMs: null, format: null, replayGain: null, expiresAt: null };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (pred: () => boolean, ms: number) => {
  const t0 = performance.now();
  while (!pred() && performance.now() - t0 < ms) await wait(5);
};

function recording(fromFrame: number, since: number) {
  const kept = chunks.filter((c) => c.frame + c.data.length > fromFrame);
  const start = kept[0]?.frame ?? fromFrame;
  const total = kept.reduce((n, c) => n + c.data.length, 0);
  const all = new Float32Array(total);
  let o = 0;
  for (const c of kept) { all.set(c.data, o); o += c.data.length; }
  const bytes = new Uint8Array(all.buffer);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const marks = events.filter((e) => e.at >= since && e.event.type !== "state").map((e) => ({ type: e.event.type, frame: e.frame - start }));
  return { sampleRate: ctx.sampleRate, marks, pcm: btoa(bin) };
}

/** A (440 Hz) puis B (660 Hz), deux albums : le fondu de `fadeMs`. A part à 16 − `leadS` s de sa fin. */
async function fade(fadeMs: number, sameAlbum = false, leadS = 9) {
  engine.stop();
  await wait(300);
  engine.setCrossfade(fadeMs);
  const since = performance.now();
  const from = Math.round(ctx.currentTime * ctx.sampleRate);
  engine.play(track("a", "A", 1, 40_000), source("/files/tone-a.flac"), 40_000 - leadS * 1000);
  await until(() => engine.getState().status === "playing", 5_000);
  engine.setNext(track("b", sameAlbum ? "A" : "B", 2, 40_000), source("/files/tone-b.flac"));
  await until(() => events.some((e) => e.at >= since && e.event.type === "advanced"), 20_000);
  await wait(fadeMs / 2 + 1_500);
  engine.stop();
  await wait(200);
  return recording(from, since);
}

/** Un GESTE : A joue, un autre titre (muet) est choisi au bout de 2 s — la sortie courte de A, seule. */
async function manual(fadeMs: number) {
  engine.stop();
  await wait(300);
  engine.setCrossfade(fadeMs);
  const since = performance.now();
  const from = Math.round(ctx.currentTime * ctx.sampleRate);
  engine.play(track("a", "A", 1, 40_000), source("/files/tone-a.flac"), 0);
  await until(() => engine.getState().status === "playing", 5_000);
  await wait(2_000);
  engine.play(track("b", "B", 1, 40_000), source("/files/silence.flac"), 0);
  await until(() => engine.getState().status === "playing", 5_000);
  await wait(1_500);
  engine.stop();
  await wait(200);
  return recording(from, since);
}

/** Une pause au milieu du fondu, 1,5 s, puis la reprise : les courbes reprennent où elles étaient. */
async function pauseMid(fadeMs: number) {
  engine.stop();
  await wait(300);
  engine.setCrossfade(fadeMs);
  const since = performance.now();
  const from = Math.round(ctx.currentTime * ctx.sampleRate);
  engine.play(track("a", "A", 1, 40_000), source("/files/tone-a.flac"), 40_000 - (fadeMs / 1000 + 3) * 1000);
  await until(() => engine.getState().status === "playing", 5_000);
  engine.setNext(track("b", "B", 2, 40_000), source("/files/tone-b.flac"));
  await wait(3_000 + fadeMs / 4);
  engine.pause();
  await wait(1_500);
  engine.resume();
  await wait(fadeMs + 1_500);
  engine.stop();
  await wait(200);
  return recording(from, since);
}

/** Témoin : une pause et une reprise HORS fondu, un seul titre — le clic d'une pause, s'il existe, est d'avant. */
async function pausePlain() {
  engine.stop();
  await wait(300);
  const since = performance.now();
  const from = Math.round(ctx.currentTime * ctx.sampleRate);
  engine.play(track("a", "A", 1, 40_000), source("/files/tone-a.flac"), 0);
  await until(() => engine.getState().status === "playing", 5_000);
  await wait(2_000);
  engine.pause();
  await wait(1_500);
  engine.resume();
  await wait(1_500);
  engine.stop();
  await wait(200);
  return recording(from, since);
}

declare global {
  interface Window {
    bench: { setup: () => Promise<void>; fade: typeof fade; manual: typeof manual; pauseMid: typeof pauseMid; pausePlain: typeof pausePlain };
  }
}
window.bench = { setup, fade, manual, pauseMid, pausePlain };
