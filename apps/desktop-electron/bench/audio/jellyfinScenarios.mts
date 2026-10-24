/**
 * Les scénarios sur le JELLYFIN DU BANC Octave (agent 3 : `bench/octave/`,
 * Jellyfin 10.11 sur le port 8196) : de vrais fichiers, servis par Jellyfin
 * (`/Audio/<id>/stream?static=true`, jeton d'un compte de TEST), lus par le
 * moteur natif. L'album « Enchaînement continu » (5 titres coupés dans un seul
 * balayage) est la référence du gapless : la sortie est comparée, à
 * l'échantillon, au décodage ffmpeg des cinq fichiers mis bout à bout.
 *
 * `OCTAVE_BENCH_ENV` : le fichier d'état du banc (adresse, comptes, jetons).
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { comparePcm, rmsOf } from "./pcmCompare.mjs";
import { benchEngine, close, ended, pcmOutput, sleep, track, type BenchEngine } from "./benchKit.mts";
import type { AudioBridgeSource } from "../../src/main/audio/audioBridgeContract.ts";

const ENV_FILE = process.env["OCTAVE_BENCH_ENV"] ?? "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/jellyfin.env";
const MUSIC = process.env["OCTAVE_BENCH_MUSIC"] ?? "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-music";

interface JfItem {
  Id: string;
  Name: string;
  Album?: string;
  IndexNumber?: number;
  Path?: string;
}

function env(): Record<string, string> {
  return Object.fromEntries(readFileSync(ENV_FILE, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1)];
  }));
}

async function album(name: string): Promise<{ url: string; token: string; items: JfItem[] }> {
  const e = env();
  const url = e["OCTAVE_JELLYFIN_URL"] ?? "";
  const token = e["OCTAVE_OCTAVE1_TOKEN"] ?? "";
  const res = await fetch(`${url}/Users/${e["OCTAVE_OCTAVE1_ID"]}/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=IndexNumber&Fields=Path`, { headers: { "X-Emby-Token": token } });
  const items = ((await res.json()) as { Items: JfItem[] }).Items.filter((i) => i.Album === name);
  return { url, token, items: items.sort((a, z) => (a.IndexNumber ?? 0) - (z.IndexNumber ?? 0)) };
}

const source = (base: string, id: string): AudioBridgeSource => ({
  url: `${base}/Audio/${id}/stream?static=true`, origin: "library", complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null,
});

/** Le fichier du banc d'après le chemin vu par Jellyfin (`/media/…` dans son conteneur). */
function localFile(item: JfItem): string {
  const rel = (item.Path ?? "").replace(/^.*?\/(Banc Octave|Kevin MacLeod|Ensemble Témoin)\//, "$1/");
  return path.join(MUSIC, rel);
}

/** Joue l'album entier, chaque suivant confié dès l'enchaînement précédent. */
async function playAlbum(b: BenchEngine, base: string, items: JfItem[]): Promise<void> {
  const [first, ...rest] = items;
  if (first === undefined) throw new Error("album vide");
  b.engine.play(track(first.Id, null, "enchainement"), source(base, first.Id), 0);
  for (const next of rest) {
    b.engine.setNext(track(next.Id, null, "enchainement"), source(base, next.Id));
    await b.waitFor((e) => e.type === "advanced" && e.toKey === next.Id, 60_000, 0);
  }
  await b.waitFor(ended, 60_000, 0);
}

export async function jfGaplessPcm(outDir: string) {
  const { url, token, items } = await album("Enchaînement continu");
  const ref = path.join(outDir, "jf-album.ref.s16");
  const pcm = items.map((i) => spawnSync("ffmpeg", ["-v", "error", "-i", localFile(i), "-map", "0:a", "-f", "s16le", "-ac", "2", "-"], { maxBuffer: 1 << 28 }).stdout);
  writeFileSync(ref, Buffer.concat(pcm));
  const out = path.join(outDir, "out-jf-album.raw");
  const b = await benchEngine({ extraOptions: pcmOutput(out) }, 1, { headers: { "X-Emby-Token": token } });
  await playAlbum(b, url, items);
  await close(b);
  return { tracks: items.length, ...comparePcm(out, ref) };
}

export async function jfGaplessRealtime() {
  const { url, token, items } = await album("Enchaînement continu");
  const durations = items.map((i) => {
    const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=duration_ts,sample_rate", "-of", "csv=p=0", localFile(i)]);
    const [rate, ts] = String(r.stdout).trim().split(",").map(Number);
    return (ts ?? 0) / (rate ?? 44100);
  });
  const b = await benchEngine({ activePumpMs: 2 }, 0.05, { headers: { "X-Emby-Token": token } });
  const samples: Array<{ t: number; pts: number }> = [];
  const playing = playAlbum(b, url, items);
  let done = false;
  void playing.then(() => (done = true));
  while (!done) {
    const raw = await b.engine.readProperty("audio-pts");
    const pts = raw === null ? NaN : Number(raw);
    if (Number.isFinite(pts)) samples.push({ t: performance.now(), pts });
  }
  await close(b);
  const junctions = [];
  let k = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1] as { t: number; pts: number };
    const c = samples[i] as { t: number; pts: number };
    if (c.pts >= a.pts - 0.05) continue;
    junctions.push({ gapMs: Number((c.t - a.t - ((durations[k] ?? 0) - a.pts + c.pts) * 1000).toFixed(1)), pollMs: Number((c.t - a.t).toFixed(1)) });
    k += 1;
  }
  return { samples: samples.length, junctions };
}

export async function jfLatency() {
  const { url, token, items } = await album("Enchaînement continu");
  const b = await benchEngine({ activePumpMs: 2 }, 0.05, { headers: { "X-Emby-Token": token } });
  const runs: number[] = [];
  for (let i = 0; i < 6; i += 1) {
    b.engine.control({ action: "stop" });
    await sleep(400);
    const t0 = performance.now();
    const item = items[i % items.length] as JfItem;
    b.engine.play(track(`${item.Id}#${i}`), source(url, item.Id), 0);
    for (;;) {
      const raw = await b.engine.readProperty("audio-pts");
      const p = raw === null ? NaN : Number(raw);
      if (Number.isFinite(p) && p > 0 && p < 0.5) {
        runs.push(Math.round(performance.now() - p * 1000 - t0));
        break;
      }
      if (performance.now() - t0 > 3000) break;
    }
  }
  await close(b);
  const sorted = [...runs].sort((a, z) => a - z);
  return { runs, median: sorted[Math.floor(sorted.length / 2)] ?? null, max: sorted.at(-1) ?? null };
}

export async function jfFormats(outDir: string) {
  const { url, token, items } = await album("Formats témoins");
  const rows = [];
  for (const item of items) {
    const out = path.join(outDir, `out-jf-${item.Id}.raw`);
    const b = await benchEngine({ extraOptions: { ...pcmOutput(out), "audio-samplerate": "44100" } }, 1, { headers: { "X-Emby-Token": token } });
    b.engine.play(track(item.Id), source(url, item.Id), 0);
    await b.waitFor(ended, 30_000, 0).catch(() => null);
    const state = b.last();
    await close(b);
    rows.push({ name: item.Name, status: state?.status, format: state?.format ?? null, rms: Number(rmsOf(out).toFixed(3)) });
  }
  return rows;
}

/** Le ReplayGain lu par mpv dans les étiquettes : le rapport de niveau mesuré face au gain écrit. */
export async function jfReplayGain(outDir: string) {
  const { url, token, items } = await album("Enchaînement continu");
  const first = items[0] as JfItem;
  const level = async (mode: "off" | "track"): Promise<number> => {
    const out = path.join(outDir, `out-jf-rg-${mode}.raw`);
    const b = await benchEngine({ extraOptions: pcmOutput(out) }, 1, { headers: { "X-Emby-Token": token }, replayGain: mode });
    b.engine.play(track(first.Id), source(url, first.Id), 0);
    await b.waitFor(ended, 30_000, 0);
    await close(b);
    return rmsOf(out);
  };
  const off = await level("off");
  const on = await level("track");
  const tag = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format_tags=REPLAYGAIN_TRACK_GAIN", "-of", "csv=p=0", localFile(first)]);
  return { tagDb: String(tag.stdout).trim(), measuredDb: Number((20 * Math.log10(on / off)).toFixed(2)) };
}
