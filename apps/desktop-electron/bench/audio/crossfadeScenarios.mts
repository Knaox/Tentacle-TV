/**
 * Le banc de la TRANSITION DOUCE au bureau : le vrai double deck (`crossfadeDecks.ts`, deux instances de la
 * vraie libmpv par koffi), sous Node, sortie `null` CADENCÉE (temps réel, rien ne sonne). Lancé SEUL (koffi ne
 * déclare pas deux fois les types de mpv dans un processus) :
 *
 *   TENTACLE_MPV_LIB=/usr/lib64/libmpv.so.2 npx tsx bench/audio/crossfadeScenarios.mts [fade6 fade2 fade12 album gesture pause]
 *
 * Deux tons au même niveau (A 468,75 Hz, B 656,25 Hz : 5 et 7 périodes entières dans les 512 échantillons que
 * mesure le filtre de niveau, à 48 kHz — sans cela, la mesure seule bruite de ±4 %). Chaque instance mesure SON niveau après le gain du fondu (le
 * filtre de la houle, `deckChain`) : relevé toutes les ~5 ms sur les deux à la fois, on en tire le gain de chacune
 * à l'horloge, la puissance totale (gA² + gB², 1 = constante), le départ de B face à celui de la courbe de A.
 * La forme fine des courbes (aucun clic, à l'échantillon) est prouvée hors temps réel par la sortie PCM du
 * filtre (rapport M2). `BENCH_PORT` (défaut 3722), `BENCH_DIR`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { AudioBridgeEvent, AudioBridgeSource, AudioBridgeTrack } from "../../src/main/audio/audioBridgeContract.ts";
import { CrossfadeDecks } from "../../src/main/audio/crossfadeDecks.ts";
import { LEVEL_PROPERTY, parseLevel } from "../../src/main/audio/audioLevel.ts";
import { benchDir } from "./fixtures.mjs";
import { startBenchServer } from "./serve.mjs";

const PORT = Number(process.env["BENCH_PORT"] ?? 3722);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const DURATION_MS = 40_000;
const track = (key: string, album: string): AudioBridgeTrack => ({ trackKey: key, albumKey: album, durationMs: DURATION_MS, format: null });
const source = (file: string): AudioBridgeSource => ({ url: `${ORIGIN}/files/${file}`, origin: "library", complete: true, sizeBytes: null, durationMs: DURATION_MS, replayGain: null, expiresAt: null });

function tones(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const [name, expr] of [["tone-xa", "0.3*sin(2*PI*468.75*t)"], ["tone-xb", "0.3*sin(2*PI*656.25*t)"]] as const) {
    const out = path.join(dir, `${name}.flac`);
    if (existsSync(out)) continue;
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `aevalsrc=${expr}:s=48000:d=40`, "-ac", "2", "-c:a", "flac", out]);
    if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr.toString()}`);
  }
}

interface Sample { t: number; a: number | null; b: number | null }
type Deck = ReturnType<CrossfadeDecks["benchDecks"]>[number];

/** Relève le niveau (dBFS) de chaque instance (`a` : celle de A, `b` : l'autre) toutes les ~5 ms, jusqu'à `untilMs`. */
async function record(pair: Deck[], untilMs: number, during?: (t: number) => Promise<void>): Promise<Sample[]> {
  const t0 = performance.now();
  const out: Sample[] = [];
  while (performance.now() - t0 < untilMs) {
    const levels = await Promise.all(pair.map((d) => d.readProperty(LEVEL_PROPERTY).then(parseLevel)));
    const t = performance.now() - t0;
    out.push({ t, a: levels[0] ?? null, b: levels[1] ?? null });
    if (during) await during(t);
    await sleep(5);
  }
  return out;
}

/** Le gain de chaque instance (1 = le ton seul, plein), la puissance, le départ du fondu. */
function analyse(samples: Sample[], refDb: number, fadeS: number) {
  const g = samples.map((s) => ({ t: s.t / 1000, a: s.a === null ? 0 : 10 ** ((s.a - refDb) / 20), b: s.b === null ? 0 : 10 ** ((s.b - refDb) / 20) }));
  // Les courbes se lisent à leurs croisements : cos(π/2·x) vaut 0,966 à x = 1/6 et 0,259 à x = 5/6 (sin, l'inverse).
  // L'instance de B, chargée en pause, garde jusqu'à son départ le niveau de ses premières trames : on part de A.
  const first = g.findIndex((p) => p.a > 0.99);
  const cross = (pick: (p: { a: number; b: number }) => number, v: number, down: boolean) =>
    g.find((p, i) => i > first && (down ? pick(p) <= v : pick(p) >= v))?.t ?? null;
  const [a1, a5, b1, b5] = [cross((p) => p.a, 0.966, true), cross((p) => p.a, 0.259, true), cross((p) => p.b, 0.259, false), cross((p) => p.b, 0.966, false)];
  if (a1 === null || a5 === null || b1 === null || b5 === null) return { found: false };
  const startS = a1 - (a5 - a1) * 0.25;
  const window = g.filter((p) => p.t >= startS + 0.1 && p.t <= startS + fadeS - 0.1);
  const powers = window.map((p) => p.a ** 2 + p.b ** 2);
  const db = (x: number) => Math.round(10 * Math.log10(x) * 100) / 100;
  const ms = (x: number) => Math.round(x * 1000);
  return {
    found: true,
    fadeOutMeasuredS: Math.round((a5 - a1) * 1.5 * 1000) / 1000,
    fadeInMeasuredS: Math.round((b5 - b1) * 1.5 * 1000) / 1000,
    // B en avance (négatif) ou en retard sur la courbe de A, au même point de la courbe.
    alignmentMs: Math.round((ms(b1) - ms(a1) + ms(b5) - ms(a5)) / 2),
    powerMinDb: db(Math.min(...powers)),
    powerMaxDb: db(Math.max(...powers)),
    envelope: window.filter((_, i) => i % 40 === 0).map((p) => `${(p.t - startS).toFixed(2)}:${p.a.toFixed(3)}/${p.b.toFixed(3)}`),
  };
}

async function engine(events: AudioBridgeEvent[]): Promise<CrossfadeDecks> {
  const decks = new CrossfadeDecks({ platform: "linux", extraOptions: { ao: "null" }, warmOutput: false, activePumpMs: 2 }, (e) => events.push(e));
  await decks.start({ serverOrigin: ORIGIN, headers: { "X-Emby-Token": "bench" }, volume: 1, muted: false, replayGain: "off", deviceId: null, exclusive: false });
  return decks;
}

/** A part à `leadS` de sa fin ; B (autre album) est le suivant, fondu de `fadeMs`. */
async function fade(fadeMs: number, opts: { sameAlbum?: boolean; pauseAt?: number } = {}) {
  const events: AudioBridgeEvent[] = [];
  const decks = await engine(events);
  decks.control({ action: "crossfade", value: fadeMs });
  await sleep(400);
  const leadS = fadeMs / 1000 + 3;
  decks.play(track("a", "A"), source("tone-xa.flac"), DURATION_MS - leadS * 1000);
  await sleep(300);
  decks.setNext(track("b", opts.sameAlbum ? "A" : "B"), source("tone-xb.flac"), opts.sameAlbum ? 0 : fadeMs);
  await sleep(200);
  const refDb = parseLevel(await decks.readProperty(LEVEL_PROPERTY)) ?? -16.5;
  let paused = false;
  const pair = decks.benchDecks();
  const samples = await record(pair, (leadS + 2) * 1000 + (opts.pauseAt === undefined ? 0 : 1500), async (t) => {
    if (opts.pauseAt === undefined) return;
    if (!paused && t > opts.pauseAt) {
      paused = true;
      decks.control({ action: "pause" });
      await sleep(1_500);
      decks.control({ action: "resume" });
    }
  });
  const advanced = events.filter((e) => e.type === "advanced");
  await decks.dispose();
  return { refDb, decks: decks.benchDecks().length, advanced, ...analyse(samples, refDb, fadeMs / 1000) };
}

/** Un GESTE, transition allumée : A joue, B choisi ; la sortie courte de A, lue sur son instance. */
async function gesture() {
  const events: AudioBridgeEvent[] = [];
  const decks = await engine(events);
  decks.control({ action: "crossfade", value: 6000 });
  await sleep(400);
  decks.play(track("a", "A"), source("tone-xa.flac"), 0);
  await sleep(1_500);
  const [deckA] = decks.benchDecks();
  const refDb = parseLevel(await decks.readProperty(LEVEL_PROPERTY)) ?? -16.5;
  const t0 = performance.now();
  decks.play(track("b", "B"), source("tone-xb.flac"), 0);
  // Comme le contrôleur : le suivant d'après, à fondre, aussitôt (il se charge sur la réserve… qui sort encore).
  decks.setNext(track("c", "C"), source("tone-xa.flac"), 6000);
  const curve: Array<{ t: number; g: number }> = [];
  while (performance.now() - t0 < 900) {
    const db = parseLevel(await deckA!.readProperty(LEVEL_PROPERTY));
    curve.push({ t: Math.round(performance.now() - t0), g: db === null ? 0 : Math.round(10 ** ((db - refDb) / 20) * 1000) / 1000 });
    await sleep(5);
  }
  const at = (v: number) => curve.find((p) => p.g < v)?.t ?? null;
  const out = { from90To1Ms: (at(0.01) ?? NaN) - (at(0.9) ?? NaN), firstDropMs: at(0.99), curve: curve.filter((_, i) => i % 6 === 0).map((p) => `${p.t}:${p.g}`) };
  await decks.dispose();
  return out;
}

const dir = benchDir("crossfade-desktop");
tones(dir);
const server = await startBenchServer(dir, PORT);
const wanted = process.argv.slice(2);
const want = (n: string) => wanted.length === 0 || wanted.includes(n);
const report: Record<string, unknown> = {};
if (want("fade6")) report["fade6s"] = await fade(6_000);
if (want("fade2")) report["fade2s"] = await fade(2_000);
if (want("fade12")) report["fade12s"] = await fade(12_000);
if (want("album")) report["sameAlbum"] = await fade(6_000, { sameAlbum: true });
if (want("pause")) report["pauseMid"] = await fade(6_000, { pauseAt: 4_000 });
if (want("gesture")) report["gesture"] = await gesture();
console.log(JSON.stringify(report, null, 1));
server.close();
process.exit(0);
