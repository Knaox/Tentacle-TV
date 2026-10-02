// Banc du transcodage lent (Apple TV) — voir README.md.
//
// Faux Tentacle + faux Jellyfin (mode proxy : tout passe par /api/jellyfin) —
// AUCUNE donnée réelle, jeton bidon. Un seul titre, « Banc transcodage »
// (MP4 h264/aac : ni PrismCore ni lecture directe — PlaybackInfo répond
// « transcodage »), servi par un HLS généré localement (hls/seg<n>.ts, 6 s).
//
// L'« encodeur » simulé, par PlaySessionId : il démarre au premier segment
// demandé (ou repart s'il est demandé trop loin devant), met `startup` ms à
// sortir son premier segment, puis produit à `speed` × le temps réel. Une
// demande de segment pas encore produit est TENUE jusqu'à sa production —
// comme Jellyfin. `speed=0` : plus rien ne sort (transcodage mort).
// Contrôle : GET /__mode?speed=0.4&startup=20000&bitrate=<b/s|0>&segrate=<b/s|0>
// (`bitrate` : le témoin de débit ; `segrate` : les segments, sinon `bitrate`),
// /__log, /__reset.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws");
const HLS = process.env.HLS_DIR ?? path.join(HERE, "hls");
const PORT = Number(process.env.PORT ?? 8650);
const SEG_S = 6;
const SEGMENTS = 100;
const T0 = Date.now();

const mode = { speed: 1, startup: 2000, bitrate: 0, segrate: 0 };
const sessions = new Map();
const log = [];
const stamp = () => ((Date.now() - T0) / 1000).toFixed(1).padStart(7);
function note(line) {
  const entry = `${stamp()}s ${line}`;
  log.push(entry);
  if (log.length > 4000) log.shift();
  console.log(entry);
}

const ticks = (s) => Math.round(s * 1e7);
const SOURCE = {
  Id: "banc-src", Container: "mp4", Bitrate: 20_000_000, RunTimeTicks: ticks(600), Name: "Banc",
  Protocol: "File", Type: "Default", SupportsDirectPlay: true, SupportsDirectStream: true, SupportsTranscoding: true,
  MediaStreams: [
    { Type: "Video", Index: 0, Codec: "h264", Width: 1920, Height: 1080, BitRate: 19_800_000, IsDefault: true, VideoRangeType: "SDR", AverageFrameRate: 24, RealFrameRate: 24, CodecTag: "avc1" },
    { Type: "Audio", Index: 1, Codec: "aac", Language: "fra", DisplayTitle: "Français - AAC - Stéréo", Channels: 2, IsDefault: true },
  ],
};
const ITEM = {
  Id: "banc-film", Name: "Banc transcodage", Type: "Movie", MediaType: "Video", ProductionYear: 2026,
  RunTimeTicks: ticks(600), Overview: "Une mire, servie lentement à volonté.", ImageTags: {}, BackdropImageTags: [],
  UserData: { PlaybackPositionTicks: 0, PlayedPercentage: 0, Played: false, IsFavorite: false },
  MediaSources: [SOURCE], ServerId: "banc",
};
const USER = { Id: "banc-user", Name: "Banc", Policy: { IsAdministrator: false } };

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const text = (res, status, body, type) => { res.writeHead(status, { "content-type": type }); res.end(body); };

function sessionOf(id) {
  let s = sessions.get(id);
  if (!s) {
    s = { id, encFrom: null, encStart: null, speed: mode.speed, startup: mode.startup, served: 0 };
    sessions.set(id, s);
  }
  return s;
}

/** Quand le segment `n` sera produit (ms depuis l'époque), `Infinity` s'il ne le sera jamais. */
function readyAt(s, n) {
  if (s.encFrom === null || n < s.encFrom) return 0;
  if (s.speed <= 0) return Infinity;
  return s.encStart + s.startup + ((n - s.encFrom + 1) * SEG_S * 1000) / s.speed;
}

function produced(s, now) {
  if (s.encFrom === null || s.speed <= 0) return s.encFrom ?? 0;
  return s.encFrom + Math.max(0, Math.floor(((now - s.encStart - s.startup) * s.speed) / (SEG_S * 1000)));
}

function startEncoder(s, n, why) {
  s.encFrom = n;
  s.encStart = Date.now();
  s.speed = mode.speed;
  s.startup = mode.startup;
  note(`[enc] ${s.id.slice(0, 8)} démarre au segment ${n} (${why}) — vitesse ×${s.speed}, premier segment ${s.startup} ms`);
}

function playlistMain(query) {
  const lines = ["#EXTM3U", "#EXT-X-PLAYLIST-TYPE:VOD", "#EXT-X-VERSION:3", `#EXT-X-TARGETDURATION:${SEG_S}`, "#EXT-X-MEDIA-SEQUENCE:0"];
  for (let n = 0; n < SEGMENTS; n++) lines.push(`#EXTINF:${SEG_S}.000000, nodesc`, `hls1/main/${n}.ts?${query}`);
  lines.push("#EXT-X-ENDLIST");
  return lines.join("\n") + "\n";
}

function serveSegment(req, res, n, sid) {
  const s = sessionOf(sid);
  const now = Date.now();
  if (s.encFrom === null || n > produced(s, now) + 4) startEncoder(s, n, s.encFrom === null ? "première demande" : "demandé loin devant");
  const at = readyAt(s, n);
  const wait = at === Infinity ? Infinity : Math.max(0, at - now);
  note(`[seg] ${sid.slice(0, 8)} #${n} demandé — ${wait === Infinity ? "JAMAIS" : `prêt dans ${Math.round(wait)} ms`}`);
  if (wait === Infinity) { req.on("close", () => note(`[seg] ${sid.slice(0, 8)} #${n} abandonné par le lecteur`)); return; }
  const timer = setTimeout(() => {
    const file = path.join(HLS, `seg${n}.ts`);
    if (!fs.existsSync(file)) return json(res, 404, {});
    const body = fs.readFileSync(file);
    res.writeHead(200, { "content-type": "video/mp2t", "content-length": body.length });
    s.served += 1;
    const rate = mode.segrate || mode.bitrate;
    if (!rate) {
      res.end(body);
      note(`[seg] ${sid.slice(0, 8)} #${n} servi (${(body.length / 1e6).toFixed(2)} Mo)`);
      return;
    }
    // Réseau bridé : le segment part à `bitrate` b/s, par tranches de 100 ms.
    const started = Date.now();
    let offset = 0;
    const step = Math.max(1, Math.round(rate / 8 / 10));
    const tick = setInterval(() => {
      if (res.destroyed) { clearInterval(tick); return; }
      res.write(body.subarray(offset, offset + step));
      offset += step;
      if (offset >= body.length) {
        clearInterval(tick);
        res.end();
        note(`[seg] ${sid.slice(0, 8)} #${n} servi bridé en ${Date.now() - started} ms`);
      }
    }, 100);
  }, wait);
  req.on("close", () => { if (!res.writableEnded) { clearTimeout(timer); note(`[seg] ${sid.slice(0, 8)} #${n} abandonné par le lecteur après ${Math.round(Date.now() - now)} ms`); } });
}

function bitrateTest(res, size) {
  res.writeHead(200, { "content-type": "application/octet-stream", "content-length": size, "cache-control": "no-store" });
  const chunk = Buffer.alloc(64 * 1024, 7);
  if (!mode.bitrate) { let left = size; while (left > 0) { res.write(chunk.subarray(0, Math.min(left, chunk.length))); left -= chunk.length; } return res.end(); }
  // Réseau bridé : `bitrate` b/s.
  let left = size;
  const tick = setInterval(() => {
    const n = Math.min(left, Math.max(1, Math.round(mode.bitrate / 8 / 10)));
    res.write(Buffer.alloc(n, 7));
    left -= n;
    if (left <= 0) { clearInterval(tick); res.end(); }
  }, 100);
}

function jellyfin(req, res, jf, url) {
  const sid = url.searchParams.get("PlaySessionId") ?? url.searchParams.get("playSessionId") ?? "sans-session";
  if (/^\/Videos\/[^/]+\/master\.m3u8$/i.test(jf)) {
    note(`[hls] master.m3u8 session ${sid.slice(0, 8)} (${url.searchParams.get("VideoBitrate") ?? "?"} b/s vidéo)`);
    const q = url.search.slice(1);
    return text(res, 200, `#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=2700000,AVERAGE-BANDWIDTH=2700000,CODECS="avc1.4d401f,mp4a.40.2",RESOLUTION=960x540,FRAME-RATE=24.000\nmain.m3u8?${q}\n`, "application/vnd.apple.mpegurl");
  }
  if (/^\/Videos\/[^/]+\/main\.m3u8$/i.test(jf)) {
    note(`[hls] main.m3u8 session ${sid.slice(0, 8)}`);
    return text(res, 200, playlistMain(url.search.slice(1)), "application/vnd.apple.mpegurl");
  }
  const seg = jf.match(/^\/Videos\/[^/]+\/hls1\/main\/(\d+)\.ts$/i);
  if (seg) return serveSegment(req, res, Number(seg[1]), sid);
  if (/\/PlaybackInfo$/i.test(jf)) {
    const playSessionId = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
    note(`[api] PlaybackInfo → transcodage, nouvelle session ${playSessionId.slice(0, 8)}`);
    return json(res, 200, {
      PlaySessionId: playSessionId,
      MediaSources: [{ ...SOURCE, SupportsDirectPlay: false, SupportsDirectStream: false, TranscodingUrl: `/videos/banc-film/master.m3u8?PlaySessionId=${playSessionId}`, TranscodingSubProtocol: "hls", TranscodingContainer: "ts" }],
    });
  }
  if (/^\/Playback\/BitrateTest$/i.test(jf)) return bitrateTest(res, Number(url.searchParams.get("size") ?? 1_000_000));
  if (/^\/System\/Info\/Public$/i.test(jf)) return json(res, 200, { ServerName: "Banc", Version: "10.11.0", Id: "banc", ProductName: "Jellyfin Server" });
  if (/^\/Sessions\//i.test(jf)) { note(`[api] ${req.method} ${jf}`); res.writeHead(204); return res.end(); }
  if (/\/Images\//i.test(jf)) return json(res, 404, {});
  if (/^\/Users\/[^/]+\/Items\/Resume$/i.test(jf)) return json(res, 200, { Items: [ITEM], TotalRecordCount: 1 });
  if (/^\/Users\/[^/]+\/Views$/i.test(jf)) return json(res, 200, { Items: [{ Id: "lib-films", Name: "Films", CollectionType: "movies" }], TotalRecordCount: 1 });
  if (/\/Items\/Latest$/i.test(jf)) return json(res, 200, []);
  if (/^\/Users\/[^/]+$/i.test(jf) || /^\/Users\/Me$/i.test(jf)) return json(res, 200, USER);
  if (/^\/(Users\/[^/]+\/)?Items\/banc-film$/i.test(jf)) return json(res, 200, ITEM);
  if (/^\/Items\/banc-film\/Ancestors$/i.test(jf)) return json(res, 200, []);
  if (/^\/MediaSegments\//i.test(jf)) return json(res, 200, { Items: [], TotalRecordCount: 0 });
  return json(res, 200, { Items: [], TotalRecordCount: 0 });
}

const unknown = new Set();
function handle(req, res) {
  const url = new URL(req.url, "http://banc");
  const p = url.pathname;
  if (p === "/__log") return text(res, 200, log.join("\n"), "text/plain; charset=utf-8");
  if (p === "/__reset") { log.length = 0; sessions.clear(); return json(res, 200, { ok: true }); }
  if (p === "/__mode") {
    for (const key of ["speed", "startup", "bitrate", "segrate"]) if (url.searchParams.has(key)) mode[key] = Number(url.searchParams.get(key));
    note(`[mode] vitesse ×${mode.speed}, premier segment ${mode.startup} ms, témoin ${mode.bitrate ? `${mode.bitrate / 1e6} Mb/s` : "libre"}, segments ${mode.segrate ? `${mode.segrate / 1e6} Mb/s` : "comme le témoin"}`);
    return json(res, 200, mode);
  }
  if (p.startsWith("/api/jellyfin/")) return jellyfin(req, res, p.slice("/api/jellyfin".length), url);
  switch (p) {
    case "/api/health": return json(res, 200, { status: "ok" });
    case "/api/setup/status": return json(res, 200, { state: "running" });
    case "/api/auth/refresh": return json(res, 200, { AccessToken: "banc" });
    case "/api/plugins/active": return json(res, 200, []);
    case "/api/watch-together/invites": return json(res, 200, []);
    case "/api/watch-together/group": return json(res, 404, {});
    case "/api/config/streaming": return json(res, 200, { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null, tokenExpired: false } });
    case "/api/preferences/language": return json(res, 200, { language: "fr" });
    default:
      if (!unknown.has(`${req.method} ${p}`)) { unknown.add(`${req.method} ${p}`); note(`[?] ${req.method} ${p}`); }
      return json(res, 404, { error: "banc" });
  }
}
// `localhost` du simulateur peut viser ::1 comme 127.0.0.1 : on écoute les deux
// (une URL en 127.0.0.1 serait prise pour le bouclage de PrismCore).
for (const host of ["127.0.0.1", "::1"]) {
  const server = http.createServer(handle);
  const wss = new WebSocketServer({ server, path: "/api/ws" });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(String(data));
        if (msg.type === "auth") ws.send(JSON.stringify({ type: "auth_ok" }));
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", t: msg.t, serverTime: Date.now() }));
      } catch { /* rien */ }
    });
  });
  server.listen(PORT, host, () => note(`faux Tentacle + Jellyfin sur [${host}]:${PORT}`));
}
