// Côté Mac de l'agent : TCP 8765 pour l'agent XCUITest (sur l'Apple TV),
// HTTP 8766 (localhost) pour moi : POST /run avec un tableau de commandes.
//   "down", "wait:0.4", "shot", "shot:1280", "hold:1.5", "tree", "focus"
import net from "node:net";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `fileURLToPath` et non `.pathname` : le chemin du dépôt a des espaces, que
// l'URL garde encodés (`%20`) — les captures partaient dans un dossier fantôme.
const OUT = process.env.AGENT_OUT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
fs.mkdirSync(OUT, { recursive: true });

let agent = null;
let buf = Buffer.alloc(0);
let pending = null; // { resolve, header?, need }
let nextId = 1;
let shotSeq = 0;

function pump() {
  while (true) {
    if (!pending) {
      // Ligne hors attente (hello) : la consommer.
      const nl = buf.indexOf(0x0a);
      if (nl < 0) return;
      const line = buf.subarray(0, nl).toString("utf8");
      buf = buf.subarray(nl + 1);
      console.log("[agent]", line);
      continue;
    }
    if (!pending.header) {
      const nl = buf.indexOf(0x0a);
      if (nl < 0) return;
      const line = buf.subarray(0, nl).toString("utf8");
      buf = buf.subarray(nl + 1);
      let header;
      try { header = JSON.parse(line); } catch { console.log("[agent?]", line); continue; }
      if (header.hello) { console.log("[agent] hello"); continue; }
      pending.header = header;
      pending.need = header.len ?? 0;
    }
    if (buf.length < pending.need) return;
    const payload = buf.subarray(0, pending.need);
    buf = buf.subarray(pending.need);
    const p = pending;
    pending = null;
    p.resolve({ header: p.header, payload });
  }
}

net.createServer((sock) => {
  console.log("agent connecté", sock.remoteAddress);
  agent = sock;
  buf = Buffer.alloc(0);
  sock.on("data", (d) => { buf = Buffer.concat([buf, d]); pump(); });
  sock.on("close", () => { console.log("agent déconnecté"); if (agent === sock) agent = null; });
  sock.on("error", (e) => console.log("agent erreur", e.message));
}).listen(8765, "0.0.0.0", () => console.log("TCP 8765 prêt"));

function send(cmd) {
  return new Promise((resolve, reject) => {
    if (!agent) return reject(new Error("agent absent"));
    const id = nextId++;
    pending = { resolve, header: null, need: 0 };
    agent.write(JSON.stringify({ id, ...cmd }) + "\n");
  });
}

function parse(c) {
  if (typeof c !== "string") return c;
  const [a, arg] = c.split(":");
  if (a === "wait" || a.startsWith("hold")) return { a, s: arg ? Number(arg) : undefined };
  if (a === "shot") return { a, w: arg ? Number(arg) : undefined };
  return { a };
}

http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/status") {
    res.end(JSON.stringify({ connected: !!agent }));
    return;
  }
  if (req.method === "POST" && req.url.startsWith("/run")) {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", async () => {
      const results = [];
      try {
        const cmds = JSON.parse(body);
        for (const raw of cmds) {
          const cmd = parse(raw);
          const t0 = Date.now();
          const { header, payload } = await send(cmd);
          const r = { a: cmd.a, ms: Date.now() - t0 };
          if (header.info) r.info = header.info;
          if (header.kind === "jpg") {
            const f = path.join(OUT, `shot-${String(++shotSeq).padStart(3, "0")}.jpg`);
            fs.writeFileSync(f, payload);
            r.file = f;
          } else if (header.kind === "txt") {
            const f = path.join(OUT, `tree-${String(++shotSeq).padStart(3, "0")}.txt`);
            fs.writeFileSync(f, payload);
            r.file = f;
          }
          results.push(r);
        }
        res.end(JSON.stringify(results, null, 1));
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e), results }));
      }
    });
    return;
  }
  res.statusCode = 404;
  res.end();
}).listen(8766, "127.0.0.1", () => console.log("HTTP 8766 prêt"));
