/**
 * Banc « premier son » du moteur `<audio>` pour un titre HORS bibliothèque
 * (lot Sillon vitesse, S5) : un vrai Chrome sans tête (CDP, aucune fenêtre),
 * la page et le relais `/api/plugins/sillon/*` sur la même origine, devant le
 * banc de Sillon (`bench/playback/firstSoundHost.ts`, socket Unix).
 *
 *   FS_SOCKET=/tmp/s5-sv.sock FS_EVENTS=ev.jsonl node apps/web/bench/audio-engine/firstSound.mjs [clics] [étiquette]
 *
 * Ports : `FS_PORT` (défaut 5305), CDP `FS_CDP` (défaut 9335).
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOCKET = process.env.FS_SOCKET ?? "/tmp/s5-sv.sock";
const PORT = Number(process.env.FS_PORT ?? 5305);
const CDP = Number(process.env.FS_CDP ?? 9335);
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const clicks = Number(process.argv[2] ?? 20);
const label = process.argv[3] ?? "web";

const bundle = await build({ entryPoints: [path.join(here, "firstSoundPage.ts")], bundle: true, write: false, format: "esm", target: "es2022", logLevel: "silent" });
const js = bundle.outputFiles[0].text;

// La page, et le relais du cœur réduit à l'essentiel (flux tenu, Range transmis, socket de l'invité).
const server = createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === "/" || url.startsWith("/page")) {
    const isJs = url.endsWith(".js");
    res.writeHead(200, { "content-type": isJs ? "text/javascript" : "text/html" });
    res.end(isJs ? js : '<!doctype html><meta charset="utf-8"><script type="module" src="/page/fs.js"></script>');
    return;
  }
  if (!url.startsWith("/api/plugins/sillon/")) return void res.writeHead(404).end();
  const up = request({ socketPath: SOCKET, method: req.method, path: url.slice("/api/plugins/sillon".length), headers: { ...req.headers, host: "tentacle-plugin" } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  res.once("close", () => up.destroy());
  up.once("error", () => res.headersSent || res.writeHead(502).end());
  req.pipe(up);
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const profile = mkdtempSync(path.join(tmpdir(), "tentacle-s5-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "about:blank",
], { stdio: "ignore" });

let target = null;
for (let i = 0; i < 50 && target === null; i += 1) {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/page/index.html`, { method: "PUT" });
    if (res.ok) target = await res.json();
  } catch {
    // Chrome démarre encore.
  }
  if (target === null) await new Promise((r) => setTimeout(r, 200));
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(String(m.data));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
async function evaluate(expression) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  const r = await new Promise((resolve) => pending.set(id, resolve));
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
}

await new Promise((r) => setTimeout(r, 800));
await evaluate("window.bench.setup()");
const salt = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
const rows = [];
for (let i = 0; i < clicks; i += 1) {
  const id = `rec:${(i + 1).toString(16).padStart(8, "0")}-0000-4000-8000-${salt}${i.toString(16).padStart(6, "0")}`;
  await new Promise((r) => setTimeout(r, 800 + ((i * 977) % 1200)));
  rows.push({ i, ...(await evaluate(`window.bench.click(${JSON.stringify(id)})`)) });
}

const events = process.env.FS_EVENTS ? readFileSync(process.env.FS_EVENTS, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
const detailed = rows.map((r, k) => {
  const until = rows[k + 1]?.t1Abs ?? Infinity;
  const mine = events.filter((e) => e.t >= r.t1Abs - 2000 && e.t < until - 2000 + 2000);
  const fb = mine.find((e) => e.ev === "upstream-first-byte" && e.t >= r.t1Abs - 500);
  const ups = mine.filter((e) => e.ev === "upstream-req" && e.t >= r.t1Abs - 500);
  const { t1Abs, ...rest } = r;
  return { ...rest, upstreamFirstByteMs: fb ? Math.round(fb.t - t1Abs) : null, upstreamRequests: ups.map((u) => `${u.range}${u.newConnection ? "*" : ""}`) };
});
const values = detailed.map((r) => r.audibleMs ?? 9999).sort((a, z) => a - z);
const q = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))];
console.log(JSON.stringify({ label, clicks: detailed, p50: q(0.5), p95: q(0.95), max: values.at(-1) }, null, 1));
ws.close();
chrome.kill();
server.close();
setTimeout(() => rmSync(profile, { recursive: true, force: true, maxRetries: 5 }), 300);
await new Promise((r) => setTimeout(r, 500));
process.exit(0);
