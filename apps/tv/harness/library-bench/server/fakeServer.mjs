// Banc des bibliothèques (Apple TV) — faux Tentacle + faux Jellyfin (mode
// proxy : tout passe par /api/jellyfin), jeton bidon, AUCUNE donnée réelle
// écrite. Voir ../README.md.
//
// Il fait aussi le relais de Metro (paquet, inspecteur, sockets) : l'app vise
// CE port pour tout, et `/__mode?bundle=<nom>` lui sert un paquet JS figé
// (`bundles/<nom>.bundle`) à la place de celui de Metro — on bascule d'une
// version à l'autre sans rien recompiler.
//
// Contrôle : /__mode?bw=50&cold=0|1&imgms=7&bundle=<nom|> · /__log · /__stats
// · /__reset[?cold=1] · POST /__probe (le rapport de la sonde) · GET /__probe.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.mjs";
import { createJellyfin } from "./jellyfin.mjs";
import { json } from "./transport.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.dirname(HERE);
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT ?? 8660);
const METRO = Number(process.env.METRO ?? 8081);
const IMG = process.env.IMG ?? path.join(BENCH, "img");
const BUNDLES = process.env.BUNDLES ?? path.join(BENCH, "bundles");
const catalog = loadCatalog({
  snapDir: process.env.SNAP ?? path.join(BENCH, "../ui-bench/snapshot"),
  imgDir: IMG,
  films: Number(process.env.FILMS ?? 1200),
  series: Number(process.env.SERIES ?? 280),
});

const mode = { bw: 50, cold: 0, imgms: 7, bundle: "" };
const freshStats = () => ({ items: 0, itemsBytes: 0, images: 0, imagesBytes: 0, unknown: {} });
const stats = freshStats();
const log = [];
const T0 = Date.now();
/** Une ligne du journal : l'heure absolue (celle de l'app, au simulateur) d'abord. */
function note(line) {
  log.push(`${Date.now()} ${((Date.now() - T0) / 1000).toFixed(2).padStart(8)}s ${line}`);
  if (log.length > 20000) log.shift();
}
const jellyfin = createJellyfin({ catalog, mode, note, stats, imgDir: IMG });

/** Tout ce qui n'est pas l'API va à Metro : paquet, statut, actifs. */
function toMetro(req, res) {
  const up = http.request({ host: "127.0.0.1", port: METRO, method: req.method, path: req.url, headers: req.headers }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(up);
}

const TENTACLE = {
  "/api/health": [200, { status: "ok", version: "1.19.1" }],
  "/api/setup/status": [200, { state: "running" }],
  "/api/auth/refresh": [200, { AccessToken: "banc" }],
  "/api/plugins/active": [200, []],
  "/api/watch-together/invites": [200, []],
  "/api/watch-together/group": [404, {}],
  "/api/config/streaming": [200, { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null, tokenExpired: false } }],
  "/api/preferences/language": [200, { language: "fr" }],
  "/api/ratings": [200, []],
  "/api/ratings/mine": [200, []],
  "/api/preferences/hints": [200, { dismissed: [] }],
};

const probes = [];
function control(req, res, p, url) {
  if (p === "/__log") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    return res.end(log.join("\n"));
  }
  if (p === "/__stats") return json(res, 200, { ...stats, mode, films: catalog.films.length, series: catalog.series.length });
  if (p === "/__reset") {
    log.length = 0;
    Object.assign(stats, freshStats());
    return json(res, 200, { ok: true });
  }
  if (p === "/__mode") {
    for (const key of Object.keys(mode)) {
      if (url.searchParams.has(key)) mode[key] = key === "bundle" ? url.searchParams.get(key) : Number(url.searchParams.get(key));
    }
    note(`[mode] ${JSON.stringify(mode)}`);
    return json(res, 200, mode);
  }
  if (req.method === "POST") {
    let body = "";
    req.on("data", (d) => { body += d; });
    req.on("end", () => {
      try { probes.push(JSON.parse(body)); } catch { probes.push({ raw: body }); }
      if (probes.length > 20) probes.shift();
      json(res, 200, { ok: true });
    });
    return undefined;
  }
  return json(res, 200, probes[probes.length - 1] ?? null);
}

function handle(req, res) {
  const url = new URL(req.url, "http://banc");
  const p = url.pathname;
  if (p.startsWith("/__")) return control(req, res, p, url);
  if (p.startsWith("/api/jellyfin/")) return jellyfin(req, res, p.slice("/api/jellyfin".length), url);
  // Un paquet JS figé, à la place de celui de Metro.
  if (p === "/index.bundle" && mode.bundle) {
    const body = fs.readFileSync(path.join(BUNDLES, `${mode.bundle}.bundle`));
    note(`[bundle] ${mode.bundle} (${(body.length / 1e6).toFixed(1)} Mo)`);
    res.writeHead(200, { "content-type": "application/javascript; charset=UTF-8", "content-length": body.length });
    return res.end(body);
  }
  if (!p.startsWith("/api/")) return toMetro(req, res);
  const known = TENTACLE[p];
  if (known) return json(res, known[0], known[1]);
  const unknown = `${req.method} ${p}`;
  stats.unknown[unknown] = (stats.unknown[unknown] ?? 0) + 1;
  return json(res, 404, { error: "banc" });
}

/** Inspecteur, messages, rechargement : la socket brute, relayée à Metro. */
function relaySocket(req, socket, head) {
  const up = net.connect(METRO, "127.0.0.1", () => {
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head && head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
}

// `localhost` du simulateur peut viser ::1 comme 127.0.0.1 : on écoute les deux.
for (const host of ["127.0.0.1", "::1"]) {
  const server = http.createServer(handle);
  server.keepAliveTimeout = 60_000;
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (req.url.startsWith("/api/ws")) return wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    return relaySocket(req, socket, head);
  });
  wss.on("connection", (ws) => {
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(String(data));
        if (msg.type === "auth") ws.send(JSON.stringify({ type: "auth_ok" }));
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", t: msg.t, serverTime: Date.now() }));
      } catch { /* rien */ }
    });
  });
  server.listen(PORT, host, () => console.log(`banc des bibliothèques sur [${host}]:${PORT} — ${catalog.films.length} films, ${catalog.series.length} séries ; Metro ${METRO}`));
}
