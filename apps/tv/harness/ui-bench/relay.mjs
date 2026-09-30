// Relais du banc UI : sert l'entrée du banc à la place de `index`, les données
// de l'instantané (JSON + images), et tient le canal de pilotage — la scène, le
// focus figé, le verre, la langue — que la ligne de commande (`bench.mjs`)
// règle sans télécommande ni navigateur. Tout le reste (sondes, HMR,
// inspecteur) passe tel quel à Metro : l'enregistrement d'un fichier se voit
// dans le simulateur, sans rien relancer.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METRO = { host: "127.0.0.1", port: Number(process.env.METRO_PORT ?? 8094) };
const PORT = Number(process.env.BENCH_PORT ?? 8093);
const ENTRY = "harness/ui-bench/entry";
// `fileURLToPath` et non `.pathname` : le chemin du dépôt a des espaces.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "snapshot");

const TYPES = { ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };

// ─── Le canal de pilotage ────────────────────────────────────────────────────
// Un état, un numéro de révision. Le banc l'écoute en attente longue ; la
// ligne de commande le modifie, puis attend que le banc dise « prêt » pour
// cette révision avant de capturer. `nativeGlass` faux : Liquid Glass simulé
// même là où le verre natif existe (le repli des tvOS < 26).
const state = { rev: 0, scene: null, focus: null, glass: true, nativeGlass: true, lang: "fr", meter: null, sweep: null };
let readyRev = 0;
let scenes = [];
const controlWaiters = new Set();
const readyWaiters = new Set();
// Les mesures d'images par seconde rendues par le banc, par numéro.
const meterResults = new Map();
const meterWaiters = new Set();

function wake(set, value) {
  for (const w of [...set]) w(value);
}

function waitFor(set, test, timeoutMs) {
  return new Promise((resolve) => {
    if (test()) return resolve(true);
    const done = (ok) => {
      clearTimeout(timer);
      set.delete(check);
      resolve(ok);
    };
    const check = () => test() && done(true);
    const timer = setTimeout(() => done(false), timeoutMs);
    set.add(check);
  });
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(payload));
}

async function bench(req, res, url) {
  if (url.pathname === "/bench/control" && req.method === "GET") {
    const since = Number(url.searchParams.get("since") ?? -1);
    await waitFor(controlWaiters, () => state.rev > since, 20_000);
    return send(res, 200, state);
  }
  if (url.pathname === "/bench/control" && req.method === "POST") {
    const patch = await readBody(req);
    for (const key of ["scene", "focus", "glass", "nativeGlass", "lang", "meter", "sweep"]) if (key in patch) state[key] = patch[key];
    state.rev += 1;
    const from = patch.from === "bench" ? "banc" : "commande";
    console.log(`[pilotage] r${state.rev} (${from}) scène=${state.scene ?? "menu"} focus=${state.focus ?? "natif"} verre=${!state.glass ? "enrichi" : state.nativeGlass ? "liquide" : "simulé"} langue=${state.lang}`);
    wake(controlWaiters);
    return send(res, 200, state);
  }
  if (url.pathname === "/bench/ready" && req.method === "POST") {
    const { rev } = await readBody(req);
    readyRev = Math.max(readyRev, Number(rev) || 0);
    wake(readyWaiters);
    return send(res, 200, { readyRev });
  }
  if (url.pathname === "/bench/ready" && req.method === "GET") {
    const rev = Number(url.searchParams.get("rev") ?? state.rev);
    const timeout = Number(url.searchParams.get("timeout") ?? 30_000);
    const ok = await waitFor(readyWaiters, () => readyRev >= rev, timeout);
    return send(res, ok ? 200 : 504, { readyRev, rev });
  }
  if (url.pathname === "/bench/meter" && req.method === "POST") {
    const result = await readBody(req);
    meterResults.set(Number(result.id), result);
    wake(meterWaiters);
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/bench/meter" && req.method === "GET") {
    const id = Number(url.searchParams.get("id"));
    const timeout = Number(url.searchParams.get("timeout") ?? 60_000);
    const ok = await waitFor(meterWaiters, () => meterResults.has(id), timeout);
    return send(res, ok ? 200 : 504, ok ? meterResults.get(id) : { id, error: "aucun résultat" });
  }
  if (url.pathname === "/bench/scenes" && req.method === "POST") {
    const list = await readBody(req);
    if (Array.isArray(list)) scenes = list;
    console.log(`[catalogue] ${scenes.length} scènes`);
    return send(res, 200, { count: scenes.length });
  }
  if (url.pathname === "/bench/scenes" && req.method === "GET") return send(res, 200, scenes);
  if (url.pathname === "/bench/state") return send(res, 200, { ...state, readyRev });
  if (url.pathname.startsWith("/bench/snapshot/")) return serveData(res, url.pathname.slice("/bench/snapshot/".length));
  return send(res, 404, { error: `banc : ${req.method} ${url.pathname} non servi` });
}

function serveData(res, relative) {
  const file = path.normalize(path.join(DATA, decodeURIComponent(relative)));
  // Rien hors du dossier des données, même par `..` encodé.
  if (!file.startsWith(DATA + path.sep)) return send(res, 403, { error: "hors du dossier des données" });
  const stream = fs.createReadStream(file);
  stream.on("error", () => send(res, 404, { error: `absent : ${relative}` }));
  stream.on("open", () => res.writeHead(200, {
    "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "cache-control": relative.endsWith(".json") ? "no-store" : "max-age=3600",
  }));
  stream.pipe(res);
}

// ─── Le relais vers Metro ────────────────────────────────────────────────────

// `BENCH_JS=prod` : le paquet de PRODUCTION (sans vérifications de dev,
// minifié) — le coût JS d'une mesure (`fps`) s'approche alors de l'appareil.
// Sans rechargement à chaud : `launch` après chaque retouche.
const PROD_JS = process.env.BENCH_JS === "prod";
const rewrite = (url) => {
  const target = url.replace(/^\/index\.(bundle|map)/, `/${ENTRY}.$1`);
  return PROD_JS ? target.replace("dev=true", "dev=false").replace("minify=false", "minify=true") : target;
};

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/bench/")) {
    bench(req, res, new URL(req.url, "http://banc")).catch((e) => send(res, 500, { error: String(e) }));
    return;
  }
  const target = rewrite(req.url);
  const upstream = http.request({ ...METRO, method: req.method, path: target, headers: req.headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on("error", (e) => {
    res.writeHead(502);
    res.end(`Metro injoignable sur ${METRO.port} : ${e.message}`);
  });
  req.pipe(upstream);
});

// WebSocket (HMR, messages, inspecteur) : on rejoue la poignée de main et on
// relie les deux sockets.
server.on("upgrade", (req, socket, head) => {
  const up = net.connect(METRO.port, METRO.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join("\r\n") + "\r\n\r\n");
    if (head?.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on("error", () => socket.destroy());
  socket.on("error", () => up.destroy());
});

server.listen(PORT, "127.0.0.1", () => console.log(`[relais] banc UI sur ${PORT} → Metro ${METRO.port} (entrée ${ENTRY}${PROD_JS ? ", JS de production" : ""})`));
