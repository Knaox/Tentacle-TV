// Le faux backend du banc de référence : faux Tentacle + faux Jellyfin (mode
// proxy) + faux Vigie, sur des données FIGÉES (l'instantané du banc UI, par
// son empreinte) et les jeux de données des domaines. Aucune donnée réelle
// n'est lue en ligne, jeton bidon, rien ne part nulle part.
//
//   PORT=3102 SNAPSHOT_DIR=<instantané figé> node fakeServer.mjs
//
// Contrôle (le lanceur s'en sert, un humain aussi) :
//   POST /__fixtures   { "sets": ["base/vigie-off", "<domaine>/<jeu>"] } — remet à la base, applique
//   GET  /__journal?since=<n>   requêtes et ÉCRITURES après le numéro n
//   GET  /__peek                numéro courant, jeux appliqués, modes
//   GET  /__modes?health=down   change un mode en cours de route (health, vigie, vigieScenario, demandes, trailers)
//   GET  /__unknown             les routes demandées que le banc ne sert pas (à ajouter)
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createDataset, DEFAULT_MODES, loadSnapshot } from "./dataset.mjs";
import { applySets, loadSets } from "./fixtures.mjs";
import { createJellyfin } from "./jellyfin.mjs";
import { createJournal } from "./journal.mjs";
import { createTentacle } from "./tentacle.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws");
const PORT = Number(process.env.PORT ?? 3102);
const SNAP = process.env.SNAPSHOT_DIR;
const SCENARIOS = process.env.SCENARIOS_DIR ?? path.join(HERE, "../scenarios");
if (!SNAP) throw new Error("SNAPSHOT_DIR manquant (le lanceur le fournit : l'instantané figé du banc UI)");

const clock = { t0: Date.now() };
const data = createDataset(loadSnapshot(SNAP), { port: PORT });
const journal = createJournal();
const unknown = new Map();
const log = (line) => console.log(`${new Date().toISOString().slice(11, 23)} ${line}`);
const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const jellyfin = createJellyfin({ data, json, snapDir: SNAP });
const tentacle = createTentacle({ data, json, note: log, clock });

function readRaw(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(Buffer.alloc(0)));
  });
}

async function control(req, res, url, raw) {
  const p = url.pathname;
  if (p === "/__fixtures" && req.method === "POST") {
    let sets = [];
    try {
      sets = JSON.parse(raw.toString("utf8") || "{}").sets ?? [];
      const applied = await applySets(data, SCENARIOS, sets);
      tentacle.vigie.made.length = 0;
      tentacle.syncVigie();
      clock.t0 = Date.now();
      journal.reset();
      log(`[jeux] ${applied.length ? applied.join(", ") : "(base seule)"}`);
      return json(res, 200, { ok: true, applied, modes: data.modes });
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message, sets });
    }
  }
  if (p === "/__journal") return json(res, 200, journal.since(Number(url.searchParams.get("since") ?? 0)));
  if (p === "/__peek") return json(res, 200, { seq: journal.seq, applied: data.applied, modes: data.modes });
  if (p === "/__modes") {
    for (const key of Object.keys(DEFAULT_MODES)) if (url.searchParams.has(key)) data.modes[key] = url.searchParams.get(key);
    tentacle.syncVigie();
    log(`[modes] ${JSON.stringify(data.modes)}`);
    return json(res, 200, data.modes);
  }
  if (p === "/__unknown") return json(res, 200, [...unknown.entries()].map(([route, count]) => ({ route, count })));
  if (p === "/__sets") {
    const { sets, errors } = await loadSets(SCENARIOS);
    return json(res, 200, { sets: [...sets.entries()].map(([name, set]) => ({ name, description: set.description ?? "" })), errors });
  }
  return json(res, 404, { error: "contrôle inconnu" });
}

async function handle(req, res) {
  const url = new URL(req.url, "http://banc");
  const raw = await readRaw(req);
  if (url.pathname.startsWith("/__")) return control(req, res, url, raw);
  let body = {};
  try {
    body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
  } catch {
    body = {};
  }
  journal.record(req.method, url.pathname, url.searchParams, body);
  // Le serveur « coupé » ou « muet » l'est pour TOUT, comme un vrai serveur absent.
  if (data.modes.health === "down") return req.socket.destroy();
  if (data.modes.health === "mute") return undefined;
  for (const route of data.routes) {
    if (route.method === req.method && route.pattern.test(url.pathname)) return route.handler(req, res, { url, body, data, json });
  }
  const img = url.pathname.match(/^\/img\/([0-9a-f]{32})\/(\w+)$/);
  if (img) return jellyfin(req, res, `/Items/${img[1]}/Images/${img[2]}`, url);
  if (url.pathname.startsWith("/api/jellyfin/") && jellyfin(req, res, url.pathname.slice("/api/jellyfin".length), url)) return undefined;
  if (await tentacle.handle(req, res, url, body, raw)) return undefined;
  const route = `${req.method} ${url.pathname.replace(/[0-9a-f]{32}/g, ":id")}`;
  if (!unknown.has(route)) log(`[?] ${route}`);
  unknown.set(route, (unknown.get(route) ?? 0) + 1);
  return json(res, 404, { error: "banc : route non servie" });
}

// `localhost` du simulateur vise ::1 comme 127.0.0.1 : on écoute les deux.
for (const host of ["127.0.0.1", "::1"]) {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      log(`[erreur] ${req.method} ${req.url} : ${error.stack ?? error.message}`);
      if (!res.headersSent) json(res, 500, { error: "banc" });
    });
  });
  const wss = new WebSocketServer({ server, path: "/api/ws" });
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === "auth") ws.send(JSON.stringify({ type: "auth_ok" }));
        if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong", t: msg.t, serverTime: Date.now() }));
      } catch {
        // message illisible : ignoré
      }
    });
  });
  server.listen(PORT, host, () => log(`faux backend nav-golden sur [${host}]:${PORT} — instantané ${SNAP}`));
}
