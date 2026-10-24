/**
 * Le geste RÉEL de l'interface, répété : un clic sur un titre PENDANT qu'un autre
 * joue (`play` → `loadfile replace`), puis le suivant confié au moteur une fois
 * le titre en lecture (`setNext`, comme le lecteur Octave depuis 248b3039b).
 * Titres variés du Jellyfin du banc (FLAC 16/44,1 et 24/96, ALAC, AAC, Opus 48 k,
 * WAV, DSD…), pour croiser les formats et les fréquences d'un clic au suivant.
 *
 * Mesure par clic : clic → premier échantillon ENTENDU (`audio-pts`, voir
 * `deviceScenarios.mts`). `BENCH_MPVLOG` : le journal de mpv, découpé ensuite
 * autour des clics lents.
 */

import { readFileSync } from "node:fs";
import { benchEngine, close, sleep, track } from "./benchKit.mts";
import type { AudioBridgeSource } from "../../src/main/audio/audioBridgeContract.ts";

const ENV_FILE = process.env["OCTAVE_BENCH_ENV"] ?? "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/jellyfin.env";

interface JfItem {
  Id: string;
  Name: string;
  Album?: string;
}

function env(): Record<string, string> {
  return Object.fromEntries(readFileSync(ENV_FILE, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
}

export async function jfClicks(count = 20, base = process.env["CLICK_BASE"] ?? null, token = process.env["CLICK_TOKEN"] ?? null) {
  const e = env();
  const jf = e["OCTAVE_JELLYFIN_URL"] ?? "";
  const userToken = e["OCTAVE_OCTAVE1_TOKEN"] ?? "";
  const res = await fetch(`${jf}/Users/${e["OCTAVE_OCTAVE1_ID"]}/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=Album,IndexNumber`, { headers: { "X-Emby-Token": userToken } });
  // Les albums du banc (les titres temporaires des autres agents n'ont pas toujours de fichier).
  const albums = new Set(["Enchaînement continu", "Formats témoins", "Duos d'été", "Bright Piano Works", "Elegant Piano", "Polka! Polka! Polka!"]);
  const items = ((await res.json()) as { Items: JfItem[] }).Items.filter((i) => albums.has(i.Album ?? ""));
  // `CLICK_IDLE_EVERY=<n>` : tous les n clics, arrêt puis `CLICK_IDLE_MS` de silence.
  const idleEvery = Number(process.env["CLICK_IDLE_EVERY"] ?? 0);
  const idleMs = Number(process.env["CLICK_IDLE_MS"] ?? 15_000);
  // `CLICK_BASE` : passer par le serveur Tentacle (`/api/music/stream/<id>`) au lieu de Jellyfin en direct.
  const url = (id: string): string => (base === null ? `${jf}/Audio/${id}/stream?static=true` : `${base}/api/music/stream/${id}`);
  const src = (id: string): AudioBridgeSource => ({ url: url(id), origin: "library", complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null });
  const b = await benchEngine({ activePumpMs: 2 }, 0.05, { headers: { "X-Emby-Token": token ?? userToken } });
  const born = performance.now();
  const clicks = [];
  for (let i = 0; i < count; i += 1) {
    // Un clic toutes les 1,5 à 4 s, pendant que le titre précédent joue.
    const idle = idleEvery > 0 && i > 0 && i % idleEvery === 0;
    if (idle) {
      b.engine.control({ action: "stop" });
      await sleep(idleMs);
    } else await sleep(1500 + ((i * 977) % 2500));
    const item = items[(i * 7) % items.length] as JfItem;
    const next = items[(i * 7 + 1) % items.length] as JfItem;
    const t0 = performance.now();
    b.engine.play(track(`${item.Id}#${i}`), src(item.Id), 0);
    let audible: number | null = null;
    let nextGiven = false;
    while (performance.now() - t0 < 5000 && audible === null) {
      const last = b.last();
      // `CLICK_NEXT_IMMEDIATE=1` : le suivant confié AUSSITÔT après `play` (le lecteur d'avant 248b3039b).
      const nextNow = process.env["CLICK_NEXT_IMMEDIATE"] === "1";
      if (!nextGiven && (nextNow || (last?.status === "playing" && last.trackKey === `${item.Id}#${i}`))) {
        nextGiven = true;
        b.engine.setNext(track(`${next.Id}#n${i}`), src(next.Id));
      }
      const raw = await b.engine.readProperty("audio-pts");
      const p = raw === null ? NaN : Number(raw);
      // Le titre précédent a joué ≥ 1,5 s : une position < 0,5 s est le nouveau.
      if (Number.isFinite(p) && p > 0 && p < 0.5) audible = performance.now() - p * 1000 - t0;
    }
    clicks.push({ i, idle, name: `${item.Album ?? "?"} — ${item.Name}`, atS: Number(((t0 - born) / 1000).toFixed(3)), audibleMs: audible === null ? null : Math.round(audible) });
  }
  await close(b);
  const values = clicks.map((c) => c.audibleMs ?? 9999).sort((a, z) => a - z);
  return {
    clicks,
    median: values[Math.floor(values.length / 2)],
    p90: values[Math.floor(values.length * 0.9)],
    max: values.at(-1),
    over500: clicks.filter((c) => (c.audibleMs ?? 9999) > 500).length,
  };
}

/**
 * Le PREMIER clic d'un processus neuf, 2,5 s après la naissance du moteur (le
 * fournisseur se monte bien avant le clic) — avec ou sans préchauffage de la
 * sortie (`CLICK_WARM=0` le coupe). Un processus par mesure : le coût de
 * CoreAudio n'est payé qu'une fois par processus.
 */
export async function firstClick(base = process.env["CLICK_BASE"] ?? null, token = process.env["CLICK_TOKEN"] ?? null) {
  const e = env();
  const jf = e["OCTAVE_JELLYFIN_URL"] ?? "";
  const userToken = e["OCTAVE_OCTAVE1_TOKEN"] ?? "";
  const res = await fetch(`${jf}/Users/${e["OCTAVE_OCTAVE1_ID"]}/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=Album,IndexNumber`, { headers: { "X-Emby-Token": userToken } });
  const item = ((await res.json()) as { Items: JfItem[] }).Items.find((i) => i.Album === "Enchaînement continu") as JfItem;
  const url = base === null ? `${jf}/Audio/${item.Id}/stream?static=true` : `${base}/api/music/stream/${item.Id}`;
  const warm = process.env["CLICK_WARM"] !== "0";
  const b = await benchEngine({ activePumpMs: 2, warmOutput: warm }, 0.05, { headers: { "X-Emby-Token": token ?? userToken } });
  await sleep(2500);
  const t0 = performance.now();
  b.engine.play(track("first"), { url, origin: "library", complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null }, 0);
  let audible: number | null = null;
  while (performance.now() - t0 < 5000 && audible === null) {
    const raw = await b.engine.readProperty("audio-pts");
    const p = raw === null ? NaN : Number(raw);
    if (Number.isFinite(p) && p > 0 && p < 0.5) audible = performance.now() - p * 1000 - t0;
  }
  await close(b);
  return { warm, audibleMs: audible === null ? null : Math.round(audible) };
}
