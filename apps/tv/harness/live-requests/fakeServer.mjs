// Banc des demandes en direct (Apple TV) — voir README.md.
//
// Faux Tentacle + faux Jellyfin (mode proxy : tout passe par /api/jellyfin),
// nourris par l'instantané du banc UI (titres, affiches) — AUCUNE donnée
// réelle n'est lue en ligne, jeton bidon — et un FAUX VIGIE : le contrat
// `titles` (`access`, `mine`), dont la liste avance toute seule au fil de
// l'horloge, temps restant compris (`etaSeconds`), comme le vrai la donnerait.
// Aucune demande ne part nulle part : `POST titles/request` est journalisé,
// jamais relayé.
//
// Contrôle :
//   GET /__mode?vigie=on|off|blocked|old&scenario=live|still|empty
//     vigie   — `off` : aucune extension ; `blocked` : compte sans droit ;
//               `old` : Vigie d'avant `access`/`mine` ;
//     scenario — `live` : deux titres en route (l'un boucle : route → mise en
//               bibliothèque → arrivé → repart), un en attente, un bloqué ;
//               `still` : rien n'avance ; `empty` : aucune demande.
//   GET /__log    — les lectures de `titles/mine` (et le reste de la Vigie), horodatées ;
//   GET /__reset  — vide le journal, l'horloge des titres repart.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws");
const PORT = Number(process.env.PORT ?? 8660);
const SNAP = process.env.SNAPSHOT_DIR ?? path.join(HERE, "../ui-bench/snapshot");
const snapshot = JSON.parse(fs.readFileSync(path.join(SNAP, "snapshot.json"), "utf8"));

const mode = { vigie: "on", scenario: "live" };
let t0 = Date.now();
const log = [];
const note = (line) => {
  const entry = `${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s ${line}`;
  log.push(entry);
  if (log.length > 4000) log.shift();
  console.log(entry);
};

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const itemOf = (id) => snapshot.items[id]?.item;
const listOf = (kind) => (snapshot.lists[kind] ?? []).map(itemOf).filter(Boolean);
const clean = (name) => String(name ?? "").replace(/^‎/, "").trim();

/* ── Le faux Vigie ───────────────────────────────────────────────────── */

const poster = (id) => `http://localhost:${PORT}/img/${id}/Primary`;
function title(kind, index, n) {
  const item = listOf(kind)[index];
  const mediaType = kind === "movies" ? "movie" : "tv";
  return { key: `${mediaType}:${9500 + n}`, title: clean(item?.Name), year: item?.ProductionYear ?? null, imageUrl: item ? poster(item.Id) : null, seasons: mediaType === "tv" ? [2] : null };
}

/** Un titre qui arrive : de `from` % à 100 en `routeS` s, puis `importS` s en mise en bibliothèque, puis `awayS` s sorti (arrivé), et ça repart. */
function lifecycle(base, { from, routeS, importS = 12, awayS = 15 }, elapsedS) {
  const e = elapsedS % (routeS + importS + awayS);
  if (e < routeS) {
    const percent = from + ((100 - from) * e) / routeS;
    return { ...base, state: "arriving", percent: Math.round(percent * 10) / 10, etaSeconds: Math.max(1, Math.round(routeS - e)) };
  }
  if (e < routeS + importS) return { ...base, state: "importing", percent: null, etaSeconds: null };
  return null;
}

function mine() {
  const elapsedS = (Date.now() - t0) / 1000;
  const still = [
    { ...title("movies", 1, 3), state: "pending", percent: null, etaSeconds: null },
    { ...title("movies", 6, 4), state: "blocked", percent: null, etaSeconds: null },
  ];
  if (mode.scenario === "empty") return [];
  if (mode.scenario === "still") return still;
  return [
    lifecycle(title("movies", 5, 1), { from: 18, routeS: 120 }, elapsedS),
    lifecycle(title("series", 3, 2), { from: 62, routeS: 400 }, elapsedS),
    ...still,
  ].filter(Boolean);
}

const TITLES = { state: "/titles/state", request: "/titles/request", access: "/titles/access", mine: "/titles/mine", seasons: "/titles/seasons" };

function activePlugins() {
  if (mode.vigie === "off") return [];
  const titles = mode.vigie === "old" ? { state: TITLES.state, request: TITLES.request } : TITLES;
  return [{ pluginId: "seer", name: "Vigie", configEnabled: true, titles }];
}

function vigie(req, res, route, url) {
  note(`[vigie] ${req.method} ${route}${url.search}`);
  if (route === TITLES.access) return json(res, 200, { request: mode.vigie !== "blocked" });
  if (route === TITLES.mine) return json(res, 200, { items: mine() });
  if (route === TITLES.state) return json(res, 200, { items: {} });
  if (route === TITLES.request) return json(res, 200, { ok: false, message: "Banc : aucune demande ne part." });
  return json(res, 404, {});
}

/* ── Le faux Jellyfin (l'instantané) ─────────────────────────────────── */

function image(res, id, type = "Primary") {
  const file = id === "profile" ? snapshot.profile?.image : snapshot.items[id]?.images?.[type];
  const full = file ? path.join(SNAP, file) : null;
  if (!full || !fs.existsSync(full)) return json(res, 404, {});
  res.writeHead(200, { "content-type": "image/jpeg", "cache-control": "max-age=3600" });
  fs.createReadStream(full).pipe(res);
}

const page = (items) => ({ Items: items, TotalRecordCount: items.length });

function jellyfin(req, res, jf, url) {
  const img = jf.match(/^\/Items\/([^/]+)\/Images\/([^/?]+)/i);
  if (img) return image(res, img[1], img[2]);
  if (/^\/Users\/[^/]+\/Images\/Primary/i.test(jf)) return image(res, "profile");
  if (/^\/System\/Info\/Public$/i.test(jf)) return json(res, 200, { ServerName: "Banc", Version: "10.11.0", Id: "banc", ProductName: "Jellyfin Server" });
  if (/^\/Sessions\//i.test(jf)) { res.writeHead(204); return res.end(); }
  if (/^\/Users\/[^/]+\/Views$/i.test(jf)) {
    return json(res, 200, page((snapshot.libraries ?? []).map((l) => ({ Id: l.id, Name: l.name, CollectionType: l.collectionType, Type: "CollectionFolder" }))));
  }
  if (/^\/Users\/[^/]+\/Items\/Resume$/i.test(jf)) return json(res, 200, page(listOf("resume")));
  if (/\/Items\/Latest$/i.test(jf)) {
    const parent = url.searchParams.get("ParentId");
    const ids = parent ? snapshot.latestByLibrary?.[parent] ?? [] : snapshot.lists.latest ?? [];
    return json(res, 200, ids.map(itemOf).filter(Boolean).slice(0, 16));
  }
  const one = jf.match(/^\/(?:Users\/[^/]+\/)?Items\/([0-9a-f]{32})$/i);
  if (one) return itemOf(one[1]) ? json(res, 200, itemOf(one[1])) : json(res, 404, {});
  if (/^\/Users\/[^/]+$/i.test(jf)) return json(res, 200, { Id: "banc-user", Name: snapshot.profile?.name ?? "Banc", Policy: { IsAdministrator: false } });
  if (/^\/(Users\/[^/]+\/)?Items$/i.test(jf)) {
    const types = url.searchParams.get("IncludeItemTypes") ?? "";
    return json(res, 200, page(/Series/i.test(types) ? listOf("series") : listOf("movies")));
  }
  return json(res, 200, page([]));
}

/* ── Le faux Tentacle ────────────────────────────────────────────────── */

const unknown = new Set();
function handle(req, res) {
  const url = new URL(req.url, "http://banc");
  const p = url.pathname;
  if (p === "/__log") { res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); return res.end(log.join("\n")); }
  if (p === "/__reset") { log.length = 0; t0 = Date.now(); return json(res, 200, { ok: true }); }
  if (p === "/__mode") {
    for (const key of ["vigie", "scenario"]) if (url.searchParams.has(key)) mode[key] = url.searchParams.get(key);
    note(`[mode] vigie=${mode.vigie} scenario=${mode.scenario}`);
    return json(res, 200, mode);
  }
  const img = p.match(/^\/img\/([0-9a-f]{32})\/(\w+)$/);
  if (img) return image(res, img[1], img[2]);
  if (p.startsWith("/api/jellyfin/")) return jellyfin(req, res, p.slice("/api/jellyfin".length), url);
  if (p.startsWith("/api/plugins/seer/")) return vigie(req, res, p.slice("/api/plugins/seer".length), url);
  switch (p) {
    case "/api/health": return json(res, 200, { status: "ok" });
    case "/api/setup/status": return json(res, 200, { state: "running" });
    case "/api/auth/refresh": return json(res, 200, { AccessToken: "banc" });
    case "/api/plugins/active": note("[tentacle] /api/plugins/active"); return json(res, 200, activePlugins());
    case "/api/watch-together/invites": return json(res, 200, []);
    case "/api/watch-together/group": return json(res, 404, {});
    case "/api/config/streaming": return json(res, 200, { directStreaming: { enabled: false, mediaBaseUrl: null, jellyfinToken: null, tokenExpired: false } });
    case "/api/preferences/language": return json(res, 200, { language: "fr" });
    case "/api/ratings": return json(res, 200, []);
    case "/api/theme": return json(res, 200, {});
    default:
      if (!unknown.has(`${req.method} ${p}`)) { unknown.add(`${req.method} ${p}`); note(`[?] ${req.method} ${p}`); }
      return json(res, 404, { error: "banc" });
  }
}

// `localhost` du simulateur vise ::1 comme 127.0.0.1 : on écoute les deux.
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
  server.listen(PORT, host, () => note(`faux Tentacle + Jellyfin + Vigie sur [${host}]:${PORT}`));
}
