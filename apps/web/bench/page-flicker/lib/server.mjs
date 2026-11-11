/**
 * Le serveur du banc : le build de production d'`apps/web`, et `/api` relayé à une VRAIE
 * instance — avec, sur demande, une mémoire sur disque des LECTURES relayées à Jellyfin.
 *
 * Pourquoi une mémoire : le banc rejoue les mêmes pages des dizaines de fois. Sur un relais
 * lent (VPN, données mobiles : ~1 s par appel), le navigateur — six connexions par hôte en
 * HTTP/1.1 — sature sa file, `/api/health` attend son tour plus de cinq secondes et la page se
 * déclare « hors ligne ». La première passe paie le réseau ; les suivantes mesurent le
 * MÉCANISME, à l'identique. Ce qui est gardé : le corps et le type des réponses 200 à un GET
 * sous `/api/jellyfin/` — jamais un en-tête de requête, jamais un jeton, hors du dépôt.
 *
 * `/api/trailers/*` n'est jamais relayé : chaque accueil rejoué préparerait des
 * bandes-annonces, et YouTube refuse après ~150 extractions (docs/BANDES-ANNONCES.md).
 */

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { connect } from "node:net";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2",
  ".wasm": "application/wasm", ".ico": "image/x-icon", ".txt": "text/plain",
};
const KEPT_HEADERS = ["content-type", "cache-control", "etag", "last-modified", "content-encoding"];
const REMEMBERED = /^\/api\/jellyfin\//;
const NEVER_RELAYED = /^\/api\/trailers\//;

/**
 * @param {{ dist: string, api: string, port: number, memory?: string }} options
 * @returns {Promise<{ url: string, stats: { hits: number, misses: number, relayed: number }, close: () => Promise<void> }>}
 */
export function startServer({ dist, api, port, memory }) {
  const target = new URL(api);
  const stats = { hits: 0, misses: 0, relayed: 0 };
  const pending = new Map();
  if (memory) mkdirSync(memory, { recursive: true });

  const relay = (req, res, remember) => {
    const upstream = request({
      host: target.hostname, port: target.port, path: req.url, method: req.method,
      headers: { ...req.headers, host: target.host },
    }, (answer) => {
      if (!remember) {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
        return;
      }
      const parts = [];
      answer.on("data", (part) => parts.push(part));
      answer.on("end", () => remember(answer.statusCode ?? 502, answer.headers, Buffer.concat(parts)));
    });
    upstream.on("error", () => (remember ? remember(502, {}, Buffer.alloc(0)) : res.writeHead(502).end()));
    req.pipe(upstream);
  };

  const serveRemembered = (req, res) => {
    const key = createHash("sha256").update(req.url).digest("hex");
    const meta = join(memory, `${key}.json`);
    const body = join(memory, `${key}.bin`);
    const send = ({ status, headers }, bytes) => {
      res.writeHead(status, { ...headers, "content-length": bytes.length });
      res.end(bytes);
    };
    if (existsSync(meta) && existsSync(body)) {
      stats.hits += 1;
      return send(JSON.parse(readFileSync(meta, "utf8")), readFileSync(body));
    }
    // Deux demandes de la même adresse en même temps : une seule part au réseau.
    let waiting = pending.get(key);
    if (!waiting) {
      stats.misses += 1;
      waiting = new Promise((done) => {
        relay(req, res, (status, upstreamHeaders, bytes) => {
          const headers = Object.fromEntries(KEPT_HEADERS.filter((name) => upstreamHeaders[name]).map((name) => [name, upstreamHeaders[name]]));
          if (status === 200) {
            writeFileSync(body, bytes);
            writeFileSync(meta, JSON.stringify({ status, headers }));
          }
          pending.delete(key);
          done({ meta: { status, headers }, bytes });
        });
      });
      pending.set(key, waiting);
    } else req.resume();
    void waiting.then(({ meta: answered, bytes }) => send(answered, bytes));
  };

  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    if (NEVER_RELAYED.test(pathname)) return void res.writeHead(503, { "content-type": "application/json" }).end('{"error":"bench"}');
    if (pathname.startsWith("/api/")) {
      if (memory && req.method === "GET" && REMEMBERED.test(pathname)) return serveRemembered(req, res);
      stats.relayed += 1;
      return relay(req, res, null);
    }
    let file = normalize(join(dist, pathname));
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) file = join(dist, "index.html");
    const immutable = pathname.startsWith("/assets/");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache" });
    createReadStream(file).pipe(res);
  });

  // Le canal de session (`/api/ws`) : un tunnel, octet pour octet.
  server.on("upgrade", (req, socket, head) => {
    const upstream = connect(Number(target.port), target.hostname, () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`, ...Object.entries({ ...req.headers, host: target.host }).map(([name, value]) => `${name}: ${value}`)];
      upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head.length > 0) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    const drop = () => { socket.destroy(); upstream.destroy(); };
    upstream.on("error", drop);
    socket.on("error", drop);
  });

  return new Promise((ready, failed) => {
    server.on("error", failed);
    server.listen(port, "127.0.0.1", () => ready({
      url: `http://127.0.0.1:${server.address().port}`,
      stats,
      close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()); }),
    }));
  });
}
