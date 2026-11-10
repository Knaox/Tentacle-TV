// Relais TCP local, bridé, que le banc COUPE à volonté — la panne de réseau simulée, jamais
// le banc lui-même. Sans dépendance (Node ≥ 22).
//   node relay.mjs <port écouté> <port visé> <octets/s>
// Commandes (HTTP sur <port écouté>+1) : /cut (coupe tout et refuse), /restore, /state.
import net from "node:net";
import http from "node:http";

const [listenPort, targetPort, rate] = process.argv.slice(2).map(Number);
const sockets = new Set();
let server = null;

function throttle(from, to) {
  // Lit, écrit, puis attend ce que le débit exige avant de lire encore.
  from.on("data", (chunk) => {
    to.write(chunk);
    if (!rate) return;
    from.pause();
    setTimeout(() => from.resume(), Math.ceil((chunk.length / rate) * 1000));
  });
}

function listen() {
  server = net.createServer((client) => {
    const upstream = net.connect(targetPort, "127.0.0.1");
    for (const s of [client, upstream]) {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
      s.on("error", () => {});
    }
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
    client.pipe(upstream);
    throttle(upstream, client);
  });
  server.listen(listenPort, "127.0.0.1");
}

listen();
http
  .createServer((req, res) => {
    if (req.url === "/cut" && server) {
      server.close();
      server = null;
      for (const s of sockets) s.destroy();
      res.end("coupé");
    } else if (req.url === "/restore" && !server) {
      listen();
      res.end("rétabli");
    } else {
      res.end(JSON.stringify({ up: server !== null, sockets: sockets.size }));
    }
  })
  .listen(listenPort + 1, "127.0.0.1");
console.log(`relais 127.0.0.1:${listenPort} → :${targetPort}, ${rate || "∞"} o/s, commandes :${listenPort + 1}`);
