// Proxy HTTP à débit limité, pour les bancs du lecteur : mpv y passe (`http-proxy`, posé par
// `TENTACLE_MPV_EXTRA`) et lit le banc Jellyfin comme un vrai serveur distant. Le débit est
// donné en octets/s ; chaque réponse est débitée par tranches de 50 ms. Journal : une ligne
// par requête (méthode, plage, octets servis, durée) — jamais l'adresse (elle porte le jeton).
// `<id>=<fichier>` : le flux `/Videos/<id>/stream` est servi depuis ce fichier local (mêmes
// pistes que l'original, voir `variantes.sh`), au même débit, avec les plages HTTP.
//   node bench/lecteur/proxy-lent.mjs <port> <octets/s> [<id>=<fichier>…]
import { createReadStream, statSync } from "node:fs";
import http from "node:http";
import { Readable } from "node:stream";

const port = Number(process.argv[2] ?? 8499);
const rate = Number(process.argv[3] ?? 64000);
const tick = 50, perTick = Math.max(1, Math.round((rate * tick) / 1000));
let n = 0;
const local = new Map(process.argv.slice(4).map((a) => [a.slice(0, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]));

// La réponse d'un fichier local, comme la sert Jellyfin (`Static=true`) : 200 ou 206.
function localResponse(req, file) {
  const size = statSync(file).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  const start = m && m[1] ? Number(m[1]) : 0, end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  const headers = { "content-type": "video/x-matroska", "accept-ranges": "bytes", "content-length": String(end - start + 1) };
  if (m) headers["content-range"] = `bytes ${start}-${end}/${size}`;
  const body = req.method === "HEAD" ? Readable.from([]) : createReadStream(file, { start, end });
  return Object.assign(body, { statusCode: m ? 206 : 200, headers });
}

http.createServer((req, res) => {
  const id = ++n, t0 = Date.now();
  let url;
  try { url = new URL(req.url); } catch { res.writeHead(400).end(); return; }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") { res.writeHead(403).end(); return; }
  const onResponse = (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    const queue = [];
    let sent = 0, ended = false;
    const timer = setInterval(() => {
      let budget = perTick;
      while (budget > 0 && queue.length) {
        const c = queue[0];
        const part = c.subarray(0, budget);
        res.write(part);
        sent += part.length; budget -= part.length;
        if (part.length === c.length) queue.shift(); else queue[0] = c.subarray(part.length);
      }
      if (queue.length < 8) r.resume();
      if (ended && !queue.length) { clearInterval(timer); res.end(); log(); }
    }, tick);
    const log = () => console.log(`#${id} ${req.method} ${req.headers.range ?? "-"} → ${r.statusCode} ${sent} o en ${Date.now() - t0} ms`);
    r.on("data", (c) => { queue.push(c); if (queue.length >= 8) r.pause(); });
    r.on("end", () => { ended = true; });
    res.on("close", () => { if (!ended || queue.length) { clearInterval(timer); r.destroy(); log(); } });
  };
  const file = local.get(/^\/Videos\/([0-9a-f]+)\/stream/.exec(url.pathname)?.[1]);
  if (file) { req.resume(); onResponse(localResponse(req, file)); return; }
  const up = http.request({ host: url.hostname, port: url.port, path: url.pathname + url.search, method: req.method,
    headers: { ...req.headers, host: url.host } }, onResponse);
  up.on("error", () => res.destroy());
  req.pipe(up);
}).listen(port, "127.0.0.1", () => console.log(`proxy lent sur 127.0.0.1:${port}, ${rate} o/s, ${local.size} flux servis en local`));
