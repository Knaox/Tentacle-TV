// Relais du banc : sert l'entrée du banc à la place de `index`, et tout le
// reste (sondes, HMR, inspecteur) tel quel à Metro. L'app de développement ne
// sait charger que `index` : c'est le relais qui lui donne le banc.
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const METRO = { host: "127.0.0.1", port: Number(process.env.METRO_PORT ?? 8081) };
const PORT = Number(process.env.BENCH_PORT ?? 8090);
const ENTRY = process.env.BENCH_ENTRY ?? "harness/focus-bench/entry";
// `fileURLToPath` et non `.pathname` : le chemin du dépôt a des espaces, que
// l'URL garde encodés (`%20`).
const HERE = path.dirname(fileURLToPath(import.meta.url));
// La vignette de toutes les cartes : l'image de référence des cartes, déjà là.
const THUMB = path.join(HERE, "..", "card-ref.png");

function rewrite(url) {
  return url.replace(/^\/index\.(bundle|map)/, `/${ENTRY}.$1`);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/bench/thumb.png")) {
    const image = fs.createReadStream(THUMB);
    image.on("error", () => {
      res.writeHead(404);
      res.end();
    });
    image.on("open", () => res.writeHead(200, { "content-type": "image/png" }));
    image.pipe(res);
    return;
  }
  const target = rewrite(req.url);
  if (target !== req.url) console.log(`réécrit ${req.url.slice(0, 60)} → ${target.slice(0, 60)}`);
  const upstream = http.request({ ...METRO, method: req.method, path: target, headers: req.headers }, (up) => {
    res.writeHead(up.statusCode ?? 502, up.headers);
    up.pipe(res);
  });
  upstream.on("error", (e) => {
    res.writeHead(502);
    res.end(String(e));
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

server.listen(PORT, "127.0.0.1", () => console.log(`relais du banc sur ${PORT} → Metro ${METRO.port} (entrée ${ENTRY})`));
