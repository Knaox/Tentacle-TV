/**
 * Banc « premier son » d'un titre HORS bibliothèque (lot Sillon vitesse, S5) :
 * une fois l'URL directe connue, combien de temps jusqu'au premier échantillon
 * ENTENDU ? Le vrai moteur natif (libmpv livrée, sous Node), devant un relais
 * `/api/plugins/sillon/*` qui reproduit celui du cœur (`relayRoute.ts` : flux
 * dans les deux sens, socket Unix de l'invité), devant le banc de Sillon
 * (`bench/playback/firstSoundHost.ts` : vraies routes de lecture, faux
 * googlevideo à la latence mesurée).
 *
 *   FS_SOCKET=/tmp/s5-sv.sock FS_EVENTS=ev.jsonl TENTACLE_MPV_LIB=livree \
 *     tsx bench/audio/firstSound.mts [clics] [variante]
 *
 * Mesures par clic (horloge absolue, la même que le banc de Sillon) :
 * `resolveMs` (clic → URL connue, hors objet), puis depuis l'URL connue :
 * requête du flux reçue par Sillon, premier octet de l'amont, premier son.
 * `FS_MPV` : options mpv de plus, `clé=valeur;clé=valeur` (leviers à éprouver).
 */

import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import Fastify from "fastify";
import { benchEngine, close, sleep, track } from "./benchKit.mts";

const SOCKET = process.env["FS_SOCKET"] ?? "/tmp/s5-sv.sock";
const EVENTS = process.env["FS_EVENTS"] ?? "";
const PORT = Number(process.env["FS_PORT"] ?? 3305);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const clicks = Number(process.argv[2] ?? 20);
const label = process.argv[3] ?? "base";
const now = (): number => performance.timeOrigin + performance.now();

// Le relais du cœur, réduit à ce qui compte pour le temps : socket Unix, flux tenu, Range transmis.
const app = Fastify();
app.removeAllContentTypeParsers();
app.addContentTypeParser("*", (_req, payload, done) => done(null, payload));
app.all("/api/plugins/sillon/*", (req, reply) => {
  const path = req.url.slice("/api/plugins/sillon".length);
  return new Promise((done) => {
    const headers = { ...req.headers, host: "tentacle-plugin" };
    const up = httpRequest({ socketPath: SOCKET, method: req.method, path, headers });
    reply.raw.once("close", () => {
      if (!reply.raw.writableFinished) up.destroy();
    });
    up.once("response", (res) => {
      reply.status(res.statusCode ?? 502).headers(res.headers as Record<string, string>);
      done(reply.send(res));
    });
    up.once("error", () => done(reply.status(502).send()));
    const body = req.body as NodeJS.ReadableStream | undefined;
    if (body && typeof body.pipe === "function") body.pipe(up);
    else up.end();
  });
});
await app.listen({ port: PORT, host: "127.0.0.1" });

const extra = Object.fromEntries(
  (process.env["FS_MPV"] ?? "").split(";").filter((kv) => kv.includes("=")).map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)]),
);
const b = await benchEngine({ activePumpMs: 2, extraOptions: extra }, 0.05, { serverOrigin: ORIGIN, headers: { "X-Emby-Token": "bench" } });
await sleep(1500);
const salt = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

interface Sourced {
  url: string;
  complete: boolean;
  sizeBytes: number | null;
  durationMs: number | null;
  expiresAt: number | null;
}

interface Click {
  i: number;
  error?: string;
  t0?: number;
  t1?: number;
  resolveMs?: number;
  audibleMs?: number | null;
}
const rows: Click[] = [];
for (let i = 0; i < clicks; i += 1) {
  // Chaque clic : un titre JAMAIS joué (enregistrement neuf, cache vide), fichier `i % n` du banc.
  const mbid = `${(i + 1).toString(16).padStart(8, "0")}-0000-4000-8000-${salt}${i.toString(16).padStart(6, "0")}`;
  const id = `rec:${mbid}`;
  await sleep(1500 + ((i * 977) % 1500));
  const t0 = now();
  const res = await fetch(`${ORIGIN}/api/plugins/sillon/music/resolve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
  const found = ((await res.json()) as { sources: { source: Sourced }[] }).sources[0]?.source;
  const t1 = now();
  if (!found) {
    rows.push({ i, error: "aucune source" });
    continue;
  }
  b.engine.play(track(`${id}#${i}`), { url: `${ORIGIN}${found.url}`, origin: "plugin", complete: found.complete, sizeBytes: found.sizeBytes, durationMs: found.durationMs, replayGain: null, expiresAt: found.expiresAt }, 0);
  let audible: number | null = null;
  while (now() - t1 < 5000 && audible === null) {
    const raw = await b.engine.readProperty("audio-pts");
    const p = raw === null ? NaN : Number(raw);
    if (Number.isFinite(p) && p > 0 && p < 0.5) audible = now() - p * 1000;
  }
  rows.push({ i, t0, t1, resolveMs: Math.round(t1 - t0), audibleMs: audible === null ? null : Math.round(audible - t1) });
}
await close(b);
await app.close();

// Les évènements de Sillon, rapportés à l'URL connue (t1) de chaque clic.
const events = EVENTS ? readFileSync(EVENTS, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { t: number; ev: string; url?: string; range?: string | null; newConnection?: boolean }) : [];
const detailed = rows.map((r) => {
  const { t0, t1 } = r;
  if (t0 === undefined || t1 === undefined) return r;
  const until = rows.find((x) => x.i === r.i + 1)?.t0 ?? Infinity;
  const mine = events.filter((e) => e.t >= t0 && e.t < until);
  const relay = mine.find((e) => e.ev === "relay-req" && (e.url ?? "").startsWith("/music/stream"));
  const ups = mine.filter((e) => e.ev === "upstream-req");
  const firstByte = mine.find((e) => e.ev === "upstream-first-byte");
  const rel = (t: number | undefined): number | null => (t === undefined ? null : Math.round(t - t1));
  return { ...r, streamReqMs: rel(relay?.t), upstreamFirstByteMs: rel(firstByte?.t), upstreamRequests: ups.map((u) => `${u.range}${u.newConnection ? "*" : ""}`) };
});
const values = detailed.map((r) => r.audibleMs ?? 9999).sort((a, z) => a - z);
const q = (p: number): number => values[Math.min(values.length - 1, Math.floor(values.length * p))] as number;
console.log(JSON.stringify({ label, clicks: detailed.map(({ t0: _a, t1: _b, ...rest }) => rest), p50: q(0.5), p95: q(0.95), max: values.at(-1) }, null, 1));
process.exit(0);
