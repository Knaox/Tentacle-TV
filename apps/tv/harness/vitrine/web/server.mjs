#!/usr/bin/env node
// Faux serveur de la vitrine WEB : le backend Tentacle et Jellyfin (derrière
// `/api/jellyfin`, comme le vrai proxy) servis depuis l'instantané LIBRE.
// Le client web de `main` s'y branche par TENTACLE_DEV_API ; aucun compte,
// aucune donnée réelle. Pilotage : `/__vitrine/lang?set=en`, `/__vitrine/journal`.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { HOME } from "../lib/paths.mjs";
import { loadLibrary } from "./library.mjs";

const PORT = Number(process.env.VITRINE_WEB_API_PORT ?? 3061);
const VIDEO_DIR = path.join(HOME, "video");
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4" };

const state = { lang: process.env.VITRINE_LANG ?? "fr", hero: process.env.VITRINE_HERO ?? "sprite-fright", journal: [], unknown: new Map() };

// Les routes se rechargent à chaud quand leur fichier change : pas de
// redémarrage du serveur entre deux retouches (l'état ci-dessus est gardé).
const HERE = path.dirname(fileURLToPath(import.meta.url));
let routes = { stamp: -1 };
async function loadRoutes() {
  const stamp = ["backend.mjs", "jellyfin.mjs"].reduce((sum, file) => sum + fs.statSync(path.join(HERE, file)).mtimeMs, 0);
  if (stamp !== routes.stamp) {
    const [backend, jellyfin] = await Promise.all([import(`./backend.mjs?v=${stamp}`), import(`./jellyfin.mjs?v=${stamp}`)]);
    routes = { stamp, backendRoute: backend.backendRoute, jellyfinRoute: jellyfin.jellyfinRoute };
  }
  return routes;
}
const journal = (line) => state.journal.push(`${new Date().toISOString().slice(11, 19)} ${line}`);

function send(res, status, json) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(json === undefined ? "" : JSON.stringify(json));
}

function sendFile(req, res, file) {
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range) {
    const start = Number(range[1] || 0);
    const end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${stat.size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "content-length": stat.size, "accept-ranges": "bytes", "cache-control": "max-age=3600" });
  fs.createReadStream(file).pipe(res);
}

/** La vidéo d'un titre : `video/<id>.mp4`, sinon celle de démonstration. */
function videoFile(id) {
  for (const name of [`${id}.mp4`, "default.mp4"]) {
    const file = path.join(VIDEO_DIR, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function control(url, res) {
  if (url.pathname === "/__vitrine/lang") {
    const lang = url.searchParams.get("set");
    if (lang === "fr" || lang === "en") state.lang = lang;
    return send(res, 200, { lang: state.lang });
  }
  if (url.pathname === "/__vitrine/hero") {
    const slug = url.searchParams.get("set");
    if (slug) state.hero = slug;
    return send(res, 200, { hero: state.hero });
  }
  if (url.pathname === "/__vitrine/journal") return send(res, 200, { journal: state.journal, unknown: [...state.unknown.entries()] });
  if (url.pathname === "/__vitrine/reset") {
    state.journal = [];
    state.unknown.clear();
    return send(res, 200, { ok: true });
  }
  return send(res, 404, { error: "commande inconnue" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/__vitrine/")) return control(url, res);
  let library;
  try {
    library = loadLibrary(state.lang);
  } catch (error) {
    return send(res, 500, { error: `instantané illisible : ${error.message} — « vitrine.mjs snapshot »` });
  }
  const method = req.method ?? "GET";
  const { backendRoute, jellyfinRoute } = await loadRoutes();
  const reply = url.pathname.startsWith("/api/jellyfin/")
    ? jellyfinRoute(library, method, url.pathname.slice("/api/jellyfin".length), url.searchParams, journal)
    : backendRoute(library, method, url.pathname, url.searchParams, journal, { hero: state.hero });
  // Le corps des requêtes n'intéresse personne ici : on le consomme et l'on répond.
  req.resume();
  if (!reply) {
    const key = `${method} ${url.pathname}`;
    state.unknown.set(key, (state.unknown.get(key) ?? 0) + 1);
    return send(res, 404, { error: "route absente de la vitrine" });
  }
  if (reply.file) return sendFile(req, res, reply.file);
  if (reply.bytes !== undefined) {
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": reply.bytes });
    return res.end(Buffer.alloc(reply.bytes));
  }
  if (reply.video) {
    const file = videoFile(reply.video);
    return file ? sendFile(req, res, file) : send(res, 404, { error: "pas de vidéo" });
  }
  return send(res, reply.status, reply.json);
});

// Le canal temps réel (`/api/ws`) : il s'ouvre, s'authentifie, puis se tait.
const require = createRequire(fileURLToPath(import.meta.url));
// `ws` résolu depuis apps/tv peut être la version 7 : `Server`, pas `WebSocketServer`.
const ws = require("ws");
const sockets = new (ws.WebSocketServer ?? ws.Server)({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  if (!req.url.startsWith("/api/ws")) return socket.destroy();
  sockets.handleUpgrade(req, socket, head, (ws) => {
    ws.on("message", () => ws.send(JSON.stringify({ type: "auth_ok", userId: loadLibrary(state.lang).user.Id })));
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`faux serveur vitrine sur http://127.0.0.1:${PORT} (${state.lang})`));
