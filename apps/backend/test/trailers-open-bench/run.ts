/* ------------------------------------------------------------------ */
/*  Banc « bandes-annonces en VP9 + Opus » — le vrai relais, YouTube   */
/*  réel, un lecteur sans H.264 ni AAC (le bureau CEF)                 */
/*                                                                     */
/*  pnpm --filter @tentacle-tv/backend bench:trailers-open -- <ytId>…  */
/*                                                                     */
/*  Monte les routes du relais (`routes/trailerMedia.ts`) sur un port  */
/*  local, résout chaque vidéo en flux LIBRE (`o:<id>`, une extraction */
/*  YouTube par vidéo — pas plus : YouTube bride les adresses          */
/*  bavardes), et sert une page qui la joue par hls.js. La page se     */
/*  charge dans la coquille CEF (`--url=http://127.0.0.1:<port>/`) ou  */
/*  dans un Chrome ; `window.__report` dit ce que le lecteur a reçu,   */
/*  décodé et joué. Sans argument : la bande-annonce de Dune 2.        */
/*                                                                     */
/*  Variables : TENTACLE_YTDLP_PINNED (zipapp yt-dlp à jour),          */
/*  TENTACLE_PYTHON (python3), BENCH_PORT (4391), BENCH_LANG (fr).     */
/* ------------------------------------------------------------------ */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { trailerMediaRoutes } from "../../src/routes/trailerMedia";
import { setTitleLanguage } from "../../src/services/reco/titleLanguage";
import { relayedStream } from "../../src/services/trailers/relayPaths";
import { prepareTrailer } from "../../src/services/trailers/trailerPrepare";
import { heldEntry, resolveTrailer } from "../../src/services/trailers/trailerRelay";
import { openYoutubeRef, youtubeRef } from "../../src/services/trailers/videoRef";

const ids = process.argv.slice(2).filter((arg) => /^[\w-]{11}$/.test(arg));
if (ids.length === 0) ids.push("Way9Dexny3w");
const port = Number(process.env.BENCH_PORT ?? 4391);
setTitleLanguage(process.env.BENCH_LANG ?? "fr");

const PAGE = `<!doctype html><meta charset="utf-8"><title>banc VP9 + Opus</title>
<body style="margin:0;background:#111;color:#ddd;font:13px sans-serif">
<video id="v" style="width:640px;height:360px;background:#000" muted playsinline></video><pre id="log"></pre>
<script src="/hls.js"></script>
<script>
const report = (window.__report = { events: [], errors: [] });
const v = document.getElementById("v");
const t0 = performance.now();
const mark = (name, extra) => { report.events.push([Math.round(performance.now() - t0), name, extra ?? ""]); document.getElementById("log").textContent = report.events.map((e) => e.join(" ")).join("\\n"); };
window.__play = (path) => new Promise((resolve) => {
  const hls = (window.__hls = new Hls());
  hls.on(Hls.Events.ERROR, (_e, d) => { report.errors.push([d.type, d.details, d.fatal]); mark("erreur", d.details + (d.fatal ? " FATALE" : "")); if (d.fatal) resolve(false); });
  hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => mark("maître", JSON.stringify(d.levels.map((l) => [l.height, l.videoCodec, l.audioCodec])) + " audio " + d.audioTracks.length));
  hls.on(Hls.Events.BUFFER_CODECS, (_e, d) => mark("tampon", Object.entries(d).filter(([, t]) => t && t.codec).map(([k, t]) => k + "=" + t.container + ";" + t.codec).join(" ")));
  hls.on(Hls.Events.FRAG_BUFFERED, (_e, d) => mark("fragment", d.frag.type + " " + d.frag.sn));
  v.addEventListener("loadeddata", () => { mark("première image"); resolve(true); }, { once: true });
  for (const e of ["playing", "waiting", "stalled", "error"]) v.addEventListener(e, () => mark("vidéo " + e, v.currentTime.toFixed(2)));
  hls.loadSource(path); hls.attachMedia(v);
});
window.__state = () => {
  const q = v.getVideoPlaybackQuality();
  const ranges = []; for (let i = 0; i < v.buffered.length; i++) ranges.push([+v.buffered.start(i).toFixed(3), +v.buffered.end(i).toFixed(3)]);
  return { t: +v.currentTime.toFixed(2), paused: v.paused, size: v.videoWidth + "x" + v.videoHeight, frames: q.totalVideoFrames, dropped: q.droppedVideoFrames,
    audioBytes: v.webkitAudioDecodedByteCount, videoBytes: v.webkitVideoDecodedByteCount, buffered: ranges, error: v.error && v.error.message };
};
</script>`;

async function main(): Promise<void> {
  const app = Fastify();
  await app.register(cors, { origin: true });
  await app.register(trailerMediaRoutes, { prefix: "/api/trailers" });
  const hlsJs = readFileSync(createRequire(join(__dirname, "../../../web/package.json")).resolve("hls.js/dist/hls.min.js"));
  app.get("/hls.js", (_request, reply) => reply.type("text/javascript").send(hlsJs));
  app.get("/", (_request, reply) => reply.type("text/html; charset=utf-8").send(PAGE));

  const videos: Array<Record<string, unknown>> = [];
  for (const id of ids) {
    const started = Date.now();
    const open = openYoutubeRef(id).key;
    const resolved = await resolveTrailer(open);
    const ready = resolved ? await prepareTrailer(open) : false;
    const entry = heldEntry(open);
    const source = entry?.source;
    // L'entrée H.264 de la même vidéo : née de la même extraction, sans rien redemander à YouTube.
    const h264 = await resolveTrailer(youtubeRef(id).key, { heldOnly: true });
    videos.push({
      ytId: id,
      ms: Date.now() - started,
      open: resolved && ready ? { path: relayedStream(open, resolved).path, heights: resolved.heights, audio: resolved.audio ?? null } : null,
      opus: source?.kind === "hls" ? (source.open?.opus ?? []).map((track) => ({ kbps: Math.round(track.bitrate), tag: track.tag })) : [],
      segments: entry?.opus ? { count: entry.opus.index.cues.length, durationS: entry.opus.index.durationS } : null,
      h264: h264 ? { path: relayedStream(youtubeRef(id).key, h264).path, heights: h264.heights } : null,
    });
    console.log(`[banc] ${id} : ${resolved && ready ? "flux libre prêt" : "PAS de flux libre"} en ${Date.now() - started} ms`);
  }
  app.get("/bench", () => ({ videos }));
  await app.listen({ port, host: "127.0.0.1" });
  console.log(`[banc] http://127.0.0.1:${port}/ — /bench liste les vidéos ; window.__play(chemin) dans la page`);
  console.log(JSON.stringify(videos, null, 1));
}

void main();
