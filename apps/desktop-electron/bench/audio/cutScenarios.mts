/**
 * S5 du plan du lot « Sillon recherche » : une URL DIRECTE coupée en milieu de titre (pause de plusieurs heures,
 * adresse de l'appareil changée). Le vrai moteur (libmpv par koffi, sous Node), le vrai relais local
 * (`clientFetch/directRelay.ts`), un faux hôte du flux direct qui sert le titre à ~2× le temps réel, COUPE la
 * connexion à 35 % du fichier puis refuse tout (403) — et le banc (`serve.mjs`) en serveur de repli.
 * Mesure : le titre reprend-il à la position, ou passe-t-il au suivant ?
 *
 *   TENTACLE_MPV_LIB=livree pnpm --filter @tentacle-tv/desktop-electron bench:audio cutRealtime
 *   CUT_BASE=<dossier> TENTACLE_MPV_LIB=livree npx tsx bench/audio/cutScenarios.mts
 *     — le moteur et le relais d'un AUTRE arbre (la base d'avant le correctif), lancé SEUL : koffi refuse de
 *     déclarer deux fois les types de mpv dans un même processus (ce module n'importe donc pas `benchKit.mts`).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { AudioBridgeEvent, AudioBridgeSource, AudioBridgeTrack } from "../../src/main/audio/audioBridgeContract.ts";
import { benchDir, generate } from "./fixtures.mjs";
import { startBenchServer } from "./serve.mjs";

// Les constantes du banc (`benchKit.mts`), recopiées : ce module se lance aussi seul (voir l'en-tête).
const PORT = 3102;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const track = (key: string, durationMs: number | null = null): AudioBridgeTrack => ({ trackKey: key, albumKey: "banc", durationMs, format: null });
const library = (file: string): AudioBridgeSource => ({ url: `${ORIGIN}/files/${file}`, origin: "library", complete: true, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null });

const DURATION_S = 24;
const CUT_AT = 0.35;

/** Un témoin de 24 s (FLAC), généré une fois. */
function longFixture(dir: string): string {
  const file = path.join(dir, "long-24s.flac");
  if (!existsSync(file)) {
    const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `anoisesrc=d=${DURATION_S}:c=pink:a=0.05`, "-ac", "2", "-ar", "44100", "-c:a", "flac", file]);
    if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr.toString()}`);
  }
  return file;
}

/** Le faux hôte du flux direct : ~2× le temps réel, connexion coupée à `CUT_AT` du fichier, puis 403 pour tout. */
async function cuttingHost(data: Buffer): Promise<{ url: string; server: Server; requests: string[] }> {
  const requests: string[] = [];
  let broken = false;
  const bps = (data.length / DURATION_S) * 2;
  const server = createServer((req, res) => {
    requests.push(req.headers.range ?? "(sans plage)");
    if (broken) return void res.writeHead(403).end();
    const from = Number(/bytes=(\d+)-/.exec(req.headers.range ?? "")?.[1] ?? 0);
    const cut = Math.floor(data.length * CUT_AT);
    res.writeHead(206, { "content-type": "audio/flac", "accept-ranges": "bytes", "content-length": String(data.length - from), "content-range": `bytes ${from}-${data.length - 1}/${data.length}` });
    let sent = from;
    const t0 = performance.now();
    const timer = setInterval(() => {
      const due = Math.min(data.length, from + Math.floor(((performance.now() - t0) / 1000) * bps) + 16384);
      if (due > cut && !broken) {
        res.write(data.subarray(sent, cut));
        broken = true;
        clearInterval(timer);
        res.socket?.destroy();
        return;
      }
      if (due > sent) res.write(data.subarray(sent, due));
      sent = due;
    }, 20);
    req.on("close", () => clearInterval(timer));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/videoplayback`, server, requests };
}

export async function cutRealtime(fx: string): Promise<Record<string, unknown>> {
  const base = process.env["CUT_BASE"];
  const root = base ? path.join(base, "apps/desktop-electron/src/main") : "../../src/main";
  const { NativeAudioEngine } = (await import(`${root}/audio/audioEngine.ts`)) as typeof import("../../src/main/audio/audioEngine.ts");
  const { DirectRelay } = (await import(`${root}/clientFetch/directRelay.ts`)) as typeof import("../../src/main/clientFetch/directRelay.ts");
  const file = longFixture(fx);
  const host = await cuttingHost(readFileSync(file));
  const relay = new DirectRelay((url, method, headers, onResponse) => httpRequest(url, { method, headers }, onResponse));
  const local = await relay.adopt(host.url, `${ORIGIN}/files/${path.basename(file)}`, { "X-Emby-Token": "bench" });
  const events: Array<{ at: number; event: AudioBridgeEvent }> = [];
  // Sortie `null` de mpv : cadencée comme une vraie sortie, sans un son (le banc tourne la nuit).
  // `BENCH_MPVLOG=<fichier>` : le journal verbeux de mpv.
  const log = process.env["BENCH_MPVLOG"];
  const extraOptions = { ao: "null", ...(log ? { "log-file": log, "msg-level": "all=v" } : {}) };
  const engine = new NativeAudioEngine({ platform: "darwin", activePumpMs: 2, extraOptions, warmOutput: false }, (event) => events.push({ at: performance.now(), event }));
  await engine.start({ serverOrigin: ORIGIN, headers: { "X-Emby-Token": "bench" }, volume: 0, muted: true, replayGain: "off", deviceId: null, exclusive: false });
  // Comme `ipc/audio.ts` : le relais dit la coupure au moteur (un arbre d'avant le correctif n'a ni l'un ni l'autre).
  const wiring = relay as { onCut?: unknown };
  const target = engine as { sourceCut?: (url: string) => void };
  if ("onCut" in wiring && typeof target.sourceCut === "function") wiring.onCut = (url: string) => target.sourceCut?.(url);
  const source: AudioBridgeSource = { url: local, origin: "plugin", complete: true, sizeBytes: null, durationMs: DURATION_S * 1000, replayGain: null, expiresAt: null };
  const t0 = performance.now();
  engine.play(track("t1", DURATION_S * 1000), source, 0);
  engine.setNext(track("t2"), library("album-2.flac"));
  const advanced = () => events.find((e) => e.event.type === "advanced");
  while (!advanced() && performance.now() - t0 < (DURATION_S + 15) * 1000) await sleep(50);
  // Les positions du titre 1 annoncées à la page, dans l'ordre : un recul (relecture) ou un saut se lisent ici.
  const positions = events.flatMap((e) => (e.event.type === "state" && e.event.state.trackKey === "t1" && e.event.state.status === "playing" ? [{ at: e.at, s: e.event.state.positionMs / 1000 }] : []));
  let gap = { ms: 0, fromS: 0, toS: 0 };
  for (let i = 1; i < positions.length; i += 1) {
    const prev = positions[i - 1] as { at: number; s: number };
    const cur = positions[i] as { at: number; s: number };
    const lost = cur.at - prev.at - (cur.s - prev.s) * 1000;
    if (lost > gap.ms) gap = { ms: Math.round(lost), fromS: Number(prev.s.toFixed(2)), toS: Number(cur.s.toFixed(2)) };
  }
  const adv = advanced();
  const lastT1 = positions.at(-1)?.s ?? null;
  const states = events.flatMap((e) => (e.event.type === "state" ? [`${Math.round(e.at - t0)} ${e.event.state.trackKey} ${e.event.state.status} ${(e.event.state.positionMs / 1000).toFixed(1)}`] : []));
  const statuses = states.filter((line, i) => i === 0 || line.split(" ").slice(1, 3).join(" ") !== (states[i - 1] ?? "").split(" ").slice(1, 3).join(" "));
  await engine.dispose();
  relay.close();
  host.server.close();
  return {
    tree: base ?? "ce dépôt",
    cutAtS: Number((DURATION_S * CUT_AT).toFixed(1)),
    advancedAfterMs: adv ? Math.round(adv.at - t0) : null,
    lastPositionOfT1S: lastT1 === null ? null : Number(lastT1.toFixed(2)),
    worstGap: gap,
    relay: relay.stats,
    directRequests: host.requests,
    statusChanges: statuses,
  };
}

// Lancé seul (la base d'avant le correctif) : son propre serveur de banc.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const fx = generate(benchDir("audio"));
  const server = await startBenchServer(fx, PORT);
  console.log(`\n## cutRealtime\n${JSON.stringify(await cutRealtime(fx), null, 1)}`);
  server.close();
  process.exit(0);
}
