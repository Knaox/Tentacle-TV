// Le relais d'images du banc : devant le faux backend de nav-golden, il sert
// les images À LA TAILLE DEMANDÉE, comme Jellyfin (`maxWidth`, `maxHeight`,
// `width`, `height`, `quality` ; jamais d'agrandissement) — l'instantané les
// garde en grand (vignettes 960×540, fonds 1920×1080), et le coût d'une image
// sur l'appareil (décodage, texture envoyée au GPU) dépend de sa taille.
// Le reste passe tel quel, WebSocket compris.
//
// Redimensionnement par ImageMagick (Lanczos), mis en cache sur disque.
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
/** Une image Jellyfin, par le relais du serveur Tentacle (`/api/jellyfin/…`) ou en direct. */
const IMAGE_PATH = /^(\/api\/jellyfin)?\/Items\/[^/]+\/Images\/|^\/img\/[0-9a-f]{32}\//i;

/** Ce que Jellyfin rendrait : la plus grande taille qui tient dans les bornes demandées, sans agrandir. */
export function targetSize(width, height, query) {
  const num = (name) => {
    const value = Number(query.get(name) ?? query.get(name.toLowerCase()));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const maxW = num("maxWidth") ?? num("width") ?? num("fillWidth");
  const maxH = num("maxHeight") ?? num("height") ?? num("fillHeight");
  let scale = 1;
  if (maxW) scale = Math.min(scale, maxW / width);
  if (maxH) scale = Math.min(scale, maxH / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), resized: scale < 1 };
}

function fetchUpstream(target, pathname) {
  return new Promise((resolve, reject) => {
    http
      .get({ host: "127.0.0.1", port: target, path: pathname }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 502, type: res.headers["content-type"] ?? "image/jpeg", body: Buffer.concat(chunks) }));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/** Taille et FORMAT réel de l'image (le faux backend dit « image/jpeg » de
 *  tout, logos PNG compris : retaillés en JPEG, ils perdaient leur
 *  transparence — un logo blanc sur un pavé noir, que Jellyfin ne rend pas). */
async function imageSize(file) {
  const { stdout } = await run("magick", ["identify", "-format", "%w %h %m", `${file}[0]`]);
  const [w, h, format] = stdout.trim().split(/\s+/);
  return { width: Number(w), height: Number(h), format: format ?? "" };
}

export function startImageProxy({ port, target, cacheDir, resize = true, log = () => {} }) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const stats = { images: 0, resized: 0, bytesIn: 0, bytesOut: 0, log: [] };

  async function serveImage(req, res, url) {
    const key = crypto.createHash("sha1").update(url.pathname).digest("hex").slice(0, 20);
    const original = path.join(cacheDir, `${key}.orig`);
    if (!fs.existsSync(original)) {
      const up = await fetchUpstream(target, url.pathname);
      if (up.status !== 200) {
        res.writeHead(up.status, { "content-type": up.type });
        return res.end(up.body);
      }
      fs.writeFileSync(original, up.body);
      fs.writeFileSync(`${original}.type`, up.type);
    }
    const { width, height, format } = await imageSize(original);
    const type = format === "PNG" ? "image/png" : format === "WEBP" ? "image/webp" : fs.readFileSync(`${original}.type`, "utf8");
    const want = targetSize(width, height, url.searchParams);
    const quality = Number(url.searchParams.get("quality")) || 90;
    let file = original;
    if (want.resized) {
      const ext = type.includes("png") ? "png" : "jpg";
      file = path.join(cacheDir, `${key}-${want.width}x${want.height}-q${quality}.${ext}`);
      if (!fs.existsSync(file)) {
        await run("magick", [`${original}[0]`, "-filter", "Lanczos", "-resize", `${want.width}x${want.height}!`, ...(ext === "jpg" ? ["-quality", String(quality)] : []), file]);
      }
      stats.resized++;
    }
    const body = fs.readFileSync(file);
    stats.images++;
    stats.bytesIn += fs.statSync(original).size;
    stats.bytesOut += body.length;
    // Chaque image servie, à sa taille rendue : ce que l'app DÉCODERA (le
    // relevé des images décodées par écran, `baseline.mjs`).
    stats.log.push({ at: Date.now(), kind: url.pathname.match(/\/Images\/(\w+)/)?.[1] ?? "img", width: want.width, height: want.height, format: type, bytes: body.length });
    res.writeHead(200, { "content-type": type, "content-length": body.length, "cache-control": "max-age=3600" });
    res.end(body);
  }

  function forward(req, res) {
    const upstream = http.request({ host: "127.0.0.1", port: target, method: req.method, path: req.url, headers: req.headers }, (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    });
    upstream.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(upstream);
  }

  // `PERF_PROXY_LOG=<fichier>` : chaque requête de l'app, une ligne (heure,
  // méthode, chemin) — ce que l'app demande AU REPOS (sondes, relectures).
  const journal = process.env.PERF_PROXY_LOG;
  const note = (method, target) => {
    if (journal) fs.appendFileSync(journal, `${Date.now()} ${method} ${target.split("?")[0]}\n`);
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://banc");
    note(req.method, url.pathname);
    // Et sa fin (statut, durée) : une requête qui ne finit pas retient l'une
    // des cinq connexions qu'OkHttp ouvre au plus par hôte.
    if (journal) {
      const started = Date.now();
      res.on("close", () => note(`← ${res.statusCode} ${Date.now() - started} ms`, url.pathname));
    }
    if (resize && req.method === "GET" && IMAGE_PATH.test(url.pathname)) {
      serveImage(req, res, url).catch((error) => {
        log(`image ${url.pathname} : ${error.message} — servie telle quelle`);
        forward(req, res);
      });
      return;
    }
    forward(req, res);
  });

  // Le WebSocket du faux Tentacle : un tunnel brut après la poignée de main.
  server.on("upgrade", (req, socket, head) => {
    note("WS", req.url ?? "/");
    const upstream = net.connect(target, "127.0.0.1", () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head?.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });

  // Les connexions ouvertes (keep-alive, tunnels WebSocket) : `close()` les
  // détruit, sinon il attendrait que l'app les lâche — elle ne le fait jamais.
  const sockets = new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (_req, socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  const close = () =>
    new Promise((done) => {
      server.close(() => done());
      for (const socket of sockets) socket.destroy();
    });
  return new Promise((resolve) => {
    server.listen(port, "::", () => resolve({ server, stats, close }));
  });
}
