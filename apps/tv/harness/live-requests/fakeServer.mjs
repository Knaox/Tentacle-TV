// Banc des demandes en direct (Apple TV) — voir README.md.
//
// Faux Tentacle + faux Jellyfin (mode proxy : tout passe par /api/jellyfin),
// nourris par l'instantané du banc UI (titres, affiches) — AUCUNE donnée
// réelle n'est lue en ligne, jeton bidon — et un FAUX VIGIE : le contrat
// `titles` (`access`, `mine`), dont la liste avance toute seule au fil de
// l'horloge, temps restant compris (`etaSeconds`), comme le vrai la donnerait.
// Aucune demande ne part nulle part : `POST titles/request` est journalisé,
// jamais relayé — avec `demandes=on`, il entre seulement dans la liste du banc.
//
// L'ORIGINE des demandes (Vigie ≥ 1.22) : chaque titre attendu dit d'où il a
// été demandé — « tv », ou rien (le web, le téléphone…) ; `mine?origin=tv` ne
// rend que ceux d'une TV, sans `origin` tout le compte.
//
// Contrôle :
//   GET /__mode?vigie=on|off|blocked|old|noorigin&scenario=live|still|empty&demandes=on|off
//     vigie   — `off` : aucune extension ; `blocked` : compte sans droit ;
//               `old` : Vigie d'avant `access`/`mine` ; `noorigin` : Vigie
//               d'avant l'origine (1.21 : il ignore le filtre, liste entière) ;
//     scenario — `live` : deux titres en route (l'un boucle : route → mise en
//               bibliothèque → arrivé → repart), un en attente, un bloqué ;
//               `still` : rien n'avance ; `empty` : aucune demande ;
//     demandes — `on` : un titre absent s'offre à la demande (`state` direct),
//               et `POST titles/request` l'ajoute à la liste du banc avec son
//               origine (en attente 8 s, puis en route 60 s, puis arrivé).
//   GET /__request?key=movie:1333100&origin=web — une demande « faite
//     ailleurs » (sans origine ; `origin=tv` : comme d'une TV), dans la liste ;
//   GET /__log    — les lectures de `titles/mine` (et le reste de la Vigie), horodatées ;
//   GET /__reset  — vide le journal et les demandes du banc, l'horloge des titres repart.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createVigie } from "./fakeVigie.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws");
const PORT = Number(process.env.PORT ?? 8660);
const SNAP = process.env.SNAPSHOT_DIR ?? path.join(HERE, "../ui-bench/snapshot");
const snapshot = JSON.parse(fs.readFileSync(path.join(SNAP, "snapshot.json"), "utf8"));

/** L'horloge des titres et du journal : `/__reset` la fait repartir. */
const clock = { t0: Date.now() };
const log = [];
const note = (line) => {
  const entry = `${((Date.now() - clock.t0) / 1000).toFixed(1).padStart(7)}s ${line}`;
  log.push(entry);
  if (log.length > 4000) log.shift();
  console.log(entry);
};

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const itemOf = (id) => snapshot.items[id]?.item;
const listOf = (kind) => (snapshot.lists[kind] ?? []).map(itemOf).filter(Boolean);
const clean = (name) => String(name ?? "").replace(/^‎/, "").trim();
const poster = (id) => `http://localhost:${PORT}/img/${id}/Primary`;
const vigie = createVigie({ snapshot, listOf, clean, poster, note, json, clock });
const { mode } = vigie;

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
  // Les saisons et épisodes d'une série de l'instantané (la bande des saisons d'une fiche).
  const showSeasons = jf.match(/^\/Shows\/([0-9a-f]{32})\/Seasons$/i);
  if (showSeasons) return json(res, 200, page((snapshot.seasons?.[showSeasons[1]] ?? []).map(itemOf).filter(Boolean)));
  if (/^\/Shows\/[0-9a-f]{32}\/Episodes$/i.test(jf)) {
    return json(res, 200, page((snapshot.episodes?.[url.searchParams.get("SeasonId")] ?? []).map(itemOf).filter(Boolean)));
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
  if (p === "/__reset") { log.length = 0; vigie.made.length = 0; clock.t0 = Date.now(); return json(res, 200, { ok: true }); }
  if (p === "/__mode") {
    for (const key of ["vigie", "scenario", "demandes"]) if (url.searchParams.has(key)) mode[key] = url.searchParams.get(key);
    note(`[mode] vigie=${mode.vigie} scenario=${mode.scenario} demandes=${mode.demandes}`);
    return json(res, 200, mode);
  }
  if (vigie.control(p, url, res)) return;
  const img = p.match(/^\/img\/([0-9a-f]{32})\/(\w+)$/);
  if (img) return image(res, img[1], img[2]);
  if (p.startsWith("/api/jellyfin/")) return jellyfin(req, res, p.slice("/api/jellyfin".length), url);
  if (p.startsWith("/api/plugins/seer/")) return void vigie.handle(req, res, p.slice("/api/plugins/seer".length), url);
  const saga = p.match(/^\/api\/sagas\/(\d+)$/);
  if (saga) return vigie.sagaOf(Number(saga[1])) ? json(res, 200, vigie.sagaOf(Number(saga[1]))) : json(res, 404, {});
  switch (p) {
    case "/api/health": return json(res, 200, { status: "ok" });
    case "/api/setup/status": return json(res, 200, { state: "running" });
    case "/api/auth/refresh": return json(res, 200, { AccessToken: "banc" });
    case "/api/plugins/active": note("[tentacle] /api/plugins/active"); return json(res, 200, vigie.activePlugins());
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
