// Un invité de test du runtime isolé (runtimeIsolation.test.ts) : il sert HTTP
// sur la socket donnée, essaie ce qu'un invité ne doit pas pouvoir faire, et
// appelle l'API d'hôte par IPC. Aucune dépendance : Node seul.
import { createServer } from "node:http";
import { appendFileSync, createReadStream, linkSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const socket = process.env.TENTACLE_PLUGIN_SOCKET;
const dataDir = process.env.TENTACLE_PLUGIN_DATA_DIR;
const probes = JSON.parse(readFileSync(new URL("./probes.json", import.meta.url), "utf8"));
let nextId = 1;
const pending = new Map();

process.on("message", (msg) => {
  if (msg.t === "result") {
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  } else if (msg.t === "shutdown") {
    appendFileSync(join(dataDir, "shutdown.log"), `${msg.reason}\n`);
    server.close(() => process.exit(0));
  }
});

function call(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    process.send({ t: "call", id, method, params });
  });
}

async function attempt(fn) {
  try {
    const value = await fn();
    return `OK ${String(value).slice(0, 40)}`;
  } catch (err) {
    return `DENIED ${err.code ?? err.message}`;
  }
}

async function probe() {
  const cp = await import("node:child_process").catch(() => null);
  const wt = await import("node:worker_threads").catch(() => null);
  return {
    readDb: await attempt(() => readFileSync(probes.db, "utf8")),
    readEnv: await attempt(() => readFileSync(probes.env, "utf8")),
    writeOutside: await attempt(() => writeFileSync(probes.outside, "x")),
    writeData: await attempt(() => writeFileSync(join(dataDir, "ok.txt"), "x")),
    symlinkDb: await attempt(() => { symlinkSync(probes.db, join(dataDir, "link")); return readFileSync(join(dataDir, "link"), "utf8"); }),
    hardlinkDb: await attempt(() => { linkSync(probes.db, join(dataDir, "hard")); return readFileSync(join(dataDir, "hard"), "utf8"); }),
    spawnBinary: await attempt(() => cp.execFileSync("/bin/echo", ["x"]).toString()),
    worker: await attempt(() => new wt.Worker("1", { eval: true })),
    jellyfinKey: process.env.JELLYFIN_API_KEY ?? "absent",
    envKeys: Object.keys(process.env).filter((k) => k !== "__CF_USER_TEXT_ENCODING").sort().join(","),
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://guest");
  // Chaque requête reçue laisse une trace : un refus de l'hôte ne doit pas en laisser.
  appendFileSync(join(dataDir, "hits.log"), `${url.pathname}\n`);
  if (url.pathname === "/probe") return res.end(JSON.stringify(await probe()));
  if (url.pathname === "/headers" || url.pathname === "/whoami") return res.end(JSON.stringify(req.headers));
  if (url.pathname === "/echo-url") return res.end(JSON.stringify({ url: req.url }));
  if (url.pathname === "/slow") {
    // Une réponse TENUE : 10 morceaux, un toutes les 500 ms, la taille finale annoncée d'emblée.
    res.writeHead(200, { "content-type": "audio/flac", "content-length": 10 * 1024 });
    let sent = 0;
    const timer = setInterval(() => {
      res.write(Buffer.alloc(1024, 3));
      if (++sent === 10) { clearInterval(timer); res.end(); }
    }, 500);
    return;
  }
  if (url.pathname === "/crash") { res.end("bye"); setTimeout(() => process.exit(3), 10); return; }
  if (url.pathname === "/host") {
    const out = await call(url.searchParams.get("m"), JSON.parse(url.searchParams.get("p") ?? "{}"));
    return res.end(JSON.stringify(out));
  }
  if (url.pathname === "/echo-body") {
    let size = 0;
    req.on("data", (chunk) => { size += chunk.length; });
    req.on("end", () => res.end(JSON.stringify({ size })));
    return;
  }
  if (url.pathname === "/stream") {
    const file = join(dataDir, "big.bin");
    const total = statSync(file).size;
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : total - 1;
      res.writeHead(206, { "content-type": "audio/flac", "content-range": `bytes ${start}-${end}/${total}`, "content-length": end - start + 1, "accept-ranges": "bytes", "set-cookie": "guest=1" });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "content-type": "audio/flac", "content-length": total, "accept-ranges": "bytes" });
    return createReadStream(file).pipe(res);
  }
  res.statusCode = 404;
  res.end();
});

server.listen(socket, () => process.send({ t: "ready", version: "test-1" }));
