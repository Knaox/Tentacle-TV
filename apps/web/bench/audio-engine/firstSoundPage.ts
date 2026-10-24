/**
 * La page du banc « premier son » du moteur `<audio>` (lot Sillon vitesse, S5),
 * bundlée par `firstSound.mjs` et servie de la même origine que le relais. Un
 * clic : la résolution (`/music/resolve` de Sillon), puis `play()` du vrai
 * moteur ; le premier échantillon NON NUL que sort l'élément (AudioWorklet),
 * ramené à `performance.now()` par `getOutputTimestamp()`, est le premier son.
 */

import type { MusicTrack, PlaybackSource } from "@tentacle-tv/shared/music";
import { HtmlAudioEngine } from "../../src/music/engine/html/htmlAudioEngine";
import type { MediaElementLike } from "../../src/music/engine/html/htmlSlot";

// Avant le premier échantillon décodé, un élément ne sort que des zéros exacts.
const ONSET = `
class Onset extends AudioWorkletProcessor {
  constructor() { super(); this.armed = false; this.port.onmessage = () => { this.armed = true; }; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (this.armed && ch) {
      for (let i = 0; i < ch.length; i++) if (Math.abs(ch[i]) > 1e-7) { this.armed = false; this.port.postMessage(currentFrame + i); break; }
    }
    return true;
  }
}
registerProcessor("onset", Onset);`;

const ctx = new AudioContext({ latencyHint: "interactive" });
let onset: AudioWorkletNode | null = null;
let onFrame: ((frame: number) => void) | null = null;

async function setup(): Promise<void> {
  await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([ONSET], { type: "application/javascript" })));
  onset = new AudioWorkletNode(ctx, "onset", { numberOfInputs: 1, numberOfOutputs: 1 });
  onset.port.onmessage = (e: MessageEvent<number>) => onFrame?.(e.data);
  const silent = ctx.createGain();
  silent.gain.value = 0;
  onset.connect(silent).connect(ctx.destination);
  await ctx.resume();
}

let lastElement: HTMLAudioElement | null = null;
const engine = new HtmlAudioEngine({
  createElement: () => {
    const el = document.createElement("audio");
    lastElement = el;
    if (onset !== null) ctx.createMediaElementSource(el).connect(onset);
    return el as MediaElementLike;
  },
  resolveUrl: (url) => url,
  credentials: null,
  canPlayType: (mime) => document.createElement("audio").canPlayType(mime),
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id as number),
  now: () => performance.now(),
});

function track(key: string): MusicTrack {
  return {
    key, jellyfinId: null, external: null, title: key, artists: [], album: { title: "Banc", mbid: null, jellyfinId: null },
    durationMs: null, trackNumber: null, discNumber: null, year: null, artworkUrl: null,
    mbids: { recording: null, release: null, releaseGroup: null, artists: [] }, availability: "external", format: null, favorite: false,
  } as unknown as MusicTrack;
}

function frameToPerf(frame: number): number {
  const ts = ctx.getOutputTimestamp();
  return (ts.performanceTime ?? performance.now()) + (frame / ctx.sampleRate - (ts.contextTime ?? ctx.currentTime)) * 1000;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function click(id: string) {
  engine.stop();
  await wait(300);
  onset?.port.postMessage("arm");
  await wait(20);
  const heard = new Promise<number>((resolve) => (onFrame = resolve));
  const t0 = performance.now();
  const res = await fetch("/api/plugins/sillon/music/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
  const found = ((await res.json()) as { sources: { source: PlaybackSource }[] }).sources[0]?.source;
  const t1 = performance.now();
  if (!found) return { error: "aucune source" };
  engine.play(track(id), found);
  const el = lastElement;
  // Comme `audio-pts` côté mpv : l'instant où la position 0 SORT, d'après la position de l'élément et la
  // latence de sortie du contexte — indépendant du contenu (un titre peut s'ouvrir sur un silence).
  let byPosition: number | null = null;
  while (byPosition === null && performance.now() - t1 < 5000) {
    const p = el?.currentTime ?? 0;
    if (p > 0 && p < 0.5) byPosition = performance.now() - p * 1000 + ((ctx.outputLatency || 0) + ctx.baseLatency) * 1000;
    else await wait(2);
  }
  const frame = await Promise.race([heard, wait(3000).then(() => null)]);
  return {
    resolveMs: Math.round(t1 - t0),
    audibleMs: byPosition === null ? null : Math.round(byPosition - t1),
    firstNonZeroMs: frame === null ? null : Math.round(frameToPerf(frame) - t1),
    t1Abs: performance.timeOrigin + t1,
  };
}

declare global {
  interface Window {
    bench: { setup: () => Promise<void>; click: (id: string) => Promise<unknown> };
  }
}
window.bench = { setup, click };
