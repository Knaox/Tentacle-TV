/**
 * Le serveur du banc audio : il joue le rôle du serveur Tentacle.
 *
 * - `/files/<chemin>` : un fichier complet, avec `Range` (la bibliothèque) ;
 * - `/grow/<chemin>?rate=<octets/s>&head=<octets>&mode=hold|close&key=<k>` :
 *   un fichier ENCORE EN ÉCRITURE. Les octets « écrits » croissent au débit
 *   donné depuis la première requête de la clé `key`. `hold` garde la
 *   réponse ouverte et pousse les octets à mesure (le relais qui diffuse en
 *   flux) ; `close` rend ce qui existe et ferme (la fin provisoire) ;
 *   `stall=<octets>:<ms>` fait caler l'écrivain ;
 * - toute requête sans `X-Emby-Token: bench` (ou `api_key=bench`, pour un
 *   `<audio>`) reçoit 401 : le banc prouve que le moteur pose l'authentification ;
 * - `/page/<nom>` : la page du banc web, de la même origine que le son.
 *
 * Chaque requête est datée (`requests`) : la latence clic → première requête
 * se lit là.
 */

import { closeSync, createReadStream, fstatSync, openSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

/** `pages` : { "<nom>": { type, body } } servis sous `/page/<nom>` (banc web). */
export function startBenchServer(root, port, pages = null) {
  const born = new Map();
  const requests = [];
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://bench");
    requests.push({ at: performance.now(), path: url.pathname, range: req.headers.range ?? null });
    // Entre guillemets JSON : une requête ne glisse pas de fin de ligne dans le journal (CodeQL js/log-injection).
    if (process.env["BENCH_DEBUG"]) {
      console.log(Math.round(performance.now()), "REQ", JSON.stringify(url.pathname), JSON.stringify(url.search), JSON.stringify(req.headers.range ?? ""));
    }
    const [, kind, ...rest] = url.pathname.split("/");
    // La page du banc web (moteur <audio>) : servie de la même origine que le
    // son, sans quoi `captureStream` rend du silence (média d'une autre origine).
    if (kind === "page" && pages !== null) {
      const page = pages[rest.join("/")];
      if (page === undefined) return void res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": page.type }).end(page.body);
      return;
    }
    // L'en-tête (moteur natif) ou `api_key` (un <audio> ne pose pas d'en-tête).
    if (req.headers["x-emby-token"] !== "bench" && url.searchParams.get("api_key") !== "bench") {
      res.writeHead(401).end();
      return;
    }
    const file = path.resolve(root, ...rest.map(decodeURIComponent));
    if (!file.startsWith(path.resolve(root) + path.sep)) return void res.writeHead(403).end();
    // UN descripteur pour la taille et les octets : un témoin régénéré entre les deux ne mêle plus la taille de
    // l'un aux octets de l'autre (CodeQL js/file-system-race).
    let fd;
    let size;
    try {
      fd = openSync(file, "r");
      size = fstatSync(fd).size;
    } catch {
      if (fd !== undefined) closeSync(fd);
      return void res.writeHead(404).end();
    }
    const readAll = () => {
      try {
        return readFileSync(fd);
      } finally {
        closeSync(fd);
      }
    };
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    const from = range ? Number(range[1]) : 0;
    if (kind === "files") {
      const to = range && range[2] ? Number(range[2]) : size - 1;
      res.writeHead(range ? 206 : 200, {
        "Content-Type": "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Content-Length": String(to - from + 1),
        ...(range ? { "Content-Range": `bytes ${from}-${to}/${size}` } : {}),
      });
      const rate = Number(url.searchParams.get("rate") ?? "0");
      if (rate <= 0) return void createReadStream("", { fd, start: from, end: to }).pipe(res);
      // Débit borné, taille connue : un fichier COMPLET servi à un rythme réaliste
      // (la sortie PCM du banc joue plus vite que le temps réel sinon).
      const data = readAll().subarray(from, to + 1);
      const t0 = performance.now();
      let sent = 0;
      const pace = () => {
        const due = Math.min(data.length, Math.floor(((performance.now() - t0) / 1000) * rate) + 16384);
        if (due > sent) res.write(data.subarray(sent, due));
        sent = due;
        if (sent >= data.length) return void res.end();
        setTimeout(pace, 10);
      };
      req.on("close", () => { sent = data.length; });
      pace();
      return;
    }
    if (kind !== "grow") {
      closeSync(fd);
      return void res.writeHead(404).end();
    }
    const rate = Number(url.searchParams.get("rate") ?? "200000");
    const head = Number(url.searchParams.get("head") ?? "65536");
    const mode = url.searchParams.get("mode") ?? "hold";
    const key = url.searchParams.get("key") ?? file;
    if (!born.has(key)) born.set(key, performance.now());
    // `stall=<octets>:<ms>` : l'écrivain CALE à cet octet pendant ce temps (un
    // téléchargement qui s'arrête), puis reprend.
    const [stallBytes, stallMs] = (url.searchParams.get("stall") ?? "0:0").split(":").map(Number);
    const written = () => {
      const t = (performance.now() - born.get(key)) / 1000;
      const free = head + Math.floor(t * rate);
      if (!stallBytes || free < stallBytes) return Math.min(size, free);
      const reached = (stallBytes - head) / rate;
      if (t < reached + stallMs / 1000) return stallBytes;
      return Math.min(size, head + Math.floor((t - stallMs / 1000) * rate));
    };
    const data = readAll();
    if (from >= written() && mode === "close") {
      res.writeHead(416, { "Content-Range": `bytes */*` }).end();
      return;
    }
    if (mode === "close") {
      // Ce qui est écrit, longueur exacte, total inconnu (`bytes a-b/*`).
      // `total=final` : le relais connaît la taille finale (`bytes a-b/taille`) ;
      // sinon `bytes a-b/*`, que ffmpeg lit mal (mesuré : sondage interrompu).
      const end = written();
      const total = url.searchParams.get("total") === "final" ? String(size) : "*";
      res.writeHead(range ? 206 : 200, {
        "Content-Type": "application/octet-stream",
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - from),
        ...(range ? { "Content-Range": `bytes ${from}-${end - 1}/${total}` } : {}),
      });
      res.end(data.subarray(from, end));
      return;
    }
    // `hold` : taille inconnue tant que l'écriture dure — pas de Content-Length,
    // des morceaux, la réponse d'un relais qui diffuse en flux.
    res.writeHead(range ? 206 : 200, {
      "Content-Type": "application/octet-stream",
      "Accept-Ranges": "bytes",
      ...(range ? { "Content-Range": `bytes ${from}-${size - 1}/*` } : {}),
    });
    let sent = from;
    const pump = () => {
      const available = written();
      if (available > sent) {
        res.write(data.subarray(sent, available));
        sent = available;
      }
      if (sent >= size) return void res.end();
      setTimeout(pump, 20);
    };
    req.on("close", () => {
      sent = size;
    });
    pump();
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve({ server, requests, close: () => server.close() }));
  });
}
