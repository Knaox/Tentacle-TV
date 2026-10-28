/**
 * Banc du hors ligne d'Octave : le MOTEUR du bureau (`DownloadEngine`, pilote de flux, SQLite, échelles de relance
 * de production) garde N titres hors bibliothèque par la route `offline` de Sillon, servie par son banc local
 * (`Tentacle-Plugin-Sillon/bench/offline/serve.ts` : vraie route, vrai cache, faux googlevideo — jamais YouTube).
 *
 *   pnpm exec tsx packages/offline-core/bench/musicKeepBench.ts --server http://127.0.0.1:3197 --tracks 20 [--music-parallel 3]
 *
 * Toutes les 50 ms, il relève ce que la page montrerait de chaque titre (la règle de `keptProgress.ts`, relue sur la
 * base) : « en file », « préparation », « anneau figé » (en cours, sans fraction), « barre » (une fraction connue).
 * Hors de `src/` : ni compilé, ni livré.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DownloadEngine, enqueueMusicBatch, ensureLayout, type EngineDeps, type MusicKeepItem } from "../src/index";
import { createStreamDriver, nodeFiles, nodePartWriter, nodeVolume, openNodeDatabase } from "../src/node/index";
import type { TransferNet } from "../src/core/transferNet";

const arg = (name: string, fallback: string): string => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 && process.argv[at + 1] !== undefined ? process.argv[at + 1]! : fallback;
};
const SERVER = arg("server", "http://127.0.0.1:3197");
const TRACKS = Number(arg("tracks", "1"));
const MUSIC_PARALLEL = Number(arg("music-parallel", "0"));

interface Trace {
  opened: number[];
  statuses: number[];
  headersAt: number | null;
  firstByteAt: number | null;
  doneAt: number | null;
  stages: Map<string, number>;
  fractions: Set<number>;
}
const traces = new Map<string, Trace>();
const traceOf = (url: string): Trace => {
  const id = decodeURIComponent(url.split("/").pop() ?? "");
  let trace = traces.get(id);
  if (!trace) {
    trace = { opened: [], statuses: [], headersAt: null, firstByteAt: null, doneAt: null, stages: new Map(), fractions: new Set() };
    traces.set(id, trace);
  }
  return trace;
};

// Le réseau du bureau, réduit à `fetch`, instrumenté : demandes, statuts, premier octet.
const net: TransferNet = {
  async open(url, headers, signal) {
    const trace = traceOf(url);
    trace.opened.push(performance.now());
    const res = await fetch(url, { headers, signal });
    trace.statuses.push(res.status);
    if (res.status < 400 && trace.headersAt === null) trace.headersAt = performance.now();
    return {
      status: res.status,
      header: (name) => res.headers.get(name),
      chunks: (async function* () {
        if (!res.body) return;
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          if (trace.firstByteAt === null) trace.firstByteAt = performance.now();
          yield value;
        }
      })(),
    };
  },
  async killTranscode() {
    /* rien au banc */
  },
};

const root = mkdtempSync(path.join(tmpdir(), "tentacle-music-bench-"));
ensureLayout(nodeVolume(root));
const db = openNodeDatabase(path.join(root, "bench.db"));
let completeCount = 0;
const deps: EngineDeps & Record<string, unknown> = {
  db,
  volume: () => nodeVolume(root),
  driver: createStreamDriver(net, nodePartWriter, nodeFiles),
  makeFetcher: () => async () => null,
  emit: () => undefined,
  now: () => Date.now(),
};
// Le parallélisme de la musique, tel que le bureau le demande (absent avant le correctif : ignoré par le moteur).
if (MUSIC_PARALLEL > 0) deps.musicParallelLimit = () => MUSIC_PARALLEL;
const engine = new DownloadEngine(deps);

const items: MusicKeepItem[] = Array.from({ length: TRACKS }, (_, i) => {
  const id = `ytm:t:bnch${String(i).padStart(7, "0")}`;
  return {
    trackKey: `ext:sillon:${id}`,
    origin: "external",
    sourcePath: `/api/plugins/sillon/music/offline/${encodeURIComponent(id)}`,
    variant: "original",
    preset: null,
    containerExt: "audio",
    expectedSize: null,
    estimatedSize: 8_448_000,
    title: `Titre ${i + 1}`,
    artist: "Banc",
    album: null,
    albumKey: null,
    discNumber: null,
    trackNumber: null,
    durationMs: 240_000,
    artworkPath: null,
    trackJson: "{}",
  };
});

/** Ce que la page montre d'un titre, relu sur la base (la règle de `keptProgress.ts`). */
function stageOf(row: { status: string; phase: string | null; paused_by_user: number; bytes_done: number; expected_size: number | null }): string {
  if (row.status === "complete") return "gardé";
  if (row.phase === "prepare" && (row.status === "downloading" || (row.status === "paused" && row.paused_by_user === 0))) return "préparation";
  if (row.status === "queued") return "en file";
  if (row.expected_size !== null && row.expected_size > 0 && row.bytes_done > 0) return "barre";
  return "anneau figé";
}

const t0 = performance.now();
const sampler = setInterval(() => {
  const rows = db.prepare("SELECT source_path, status, phase, paused_by_user, bytes_done, expected_size FROM files").all() as unknown as {
    source_path: string; status: string; phase: string | null; paused_by_user: number; bytes_done: number; expected_size: number | null;
  }[];
  for (const row of rows) {
    const trace = traceOf(row.source_path);
    const stage = stageOf(row);
    trace.stages.set(stage, (trace.stages.get(stage) ?? 0) + 50);
    if (stage === "barre" && row.expected_size) trace.fractions.add(Math.round((row.bytes_done / row.expected_size) * 100));
    if (row.status === "complete" && trace.doneAt === null) {
      trace.doneAt = performance.now();
      completeCount += 1;
    }
  }
  if (completeCount === TRACKS) finish();
}, 50);

engine.start({ serverUrl: SERVER, token: "banc" });
const outcome = enqueueMusicBatch(db, "bench", items, 1e12, Date.now());
if (!outcome.accepted) throw new Error("lot refusé");
engine.notifyChanged();
engine.pump();

const ms = (v: number) => `${(v / 1000).toFixed(2)} s`;
async function finish(): Promise<void> {
  clearInterval(sampler);
  const total = performance.now() - t0;
  const rows = [...traces.values()];
  const avg = (pick: (t: Trace) => number) => rows.reduce((s, t) => s + pick(t), 0) / rows.length;
  const prep = (t: Trace) => (t.headersAt ?? t.doneAt ?? 0) - (t.opened[0] ?? t0);
  const transfer = (t: Trace) => (t.doneAt ?? 0) - (t.headersAt ?? t.doneAt ?? 0);
  const stageTotals = new Map<string, number>();
  for (const t of rows) for (const [stage, v] of t.stages) stageTotals.set(stage, (stageTotals.get(stage) ?? 0) + v);
  const stats = await fetch(`${SERVER}/bench/stats`).then((r) => r.json()).catch(() => null);
  console.log(JSON.stringify({ tracks: TRACKS, musicParallel: MUSIC_PARALLEL || 1, server: stats }));
  console.log(`total ${ms(total)} · par titre ${ms(total / TRACKS)}`);
  console.log(`préparation vue du client (demande → en-têtes 2xx) : moyenne ${ms(avg(prep))}, max ${ms(Math.max(...rows.map(prep)))}`);
  console.log(`transfert (en-têtes → gardé) : moyenne ${ms(avg(transfer))} · 503 reçus : ${rows.reduce((s, t) => s + t.statuses.filter((x) => x === 503).length, 0)}`);
  console.log(`ce que la page montre (somme des titres) : ${[...stageTotals].map(([k, v]) => `${k} ${ms(v)}`).join(" · ")}`);
  console.log(`valeurs de barre distinctes (moyenne par titre) : ${avg((t) => t.fractions.size).toFixed(1)}`);
  rmSync(root, { recursive: true, force: true });
  process.exit(0);
}
