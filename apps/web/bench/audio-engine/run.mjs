/**
 * Le banc du moteur `<audio>` (web) : un vrai Chrome sans tête, piloté par CDP
 * (port 9232), sur les fichiers témoins du banc audio du bureau.
 *
 *   node apps/web/bench/audio-engine/run.mjs [latency] [album] [swap]
 *
 * Aucune fenêtre (aucun focus volé) ; le son passe par le graphe Web Audio de
 * la page, jamais par les haut-parleurs. `BENCH_DIR` : dossier des fichiers
 * témoins (défaut : un dossier temporaire). Chrome : `CHROME`, sinon celui du
 * système.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generate } from "../../../desktop-electron/bench/audio/fixtures.mjs";
import { startBenchServer } from "../../../desktop-electron/bench/audio/serve.mjs";
import { referenceAt, trackLag } from "./lagTrack.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3102;
const CDP = 9232;
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const dir = process.env.BENCH_DIR ?? path.join(tmpdir(), "tentacle-audio-bench");
mkdirSync(dir, { recursive: true });
const fx = generate(dir);

const bundle = await build({ entryPoints: [path.join(here, "benchPage.ts")], bundle: true, write: false, format: "esm", target: "es2022", logLevel: "silent" });
const js = bundle.outputFiles[0].text;
const pages = {
  "index.html": { type: "text/html", body: '<!doctype html><meta charset="utf-8"><script type="module" src="/page/bench.js"></script>' },
  "bench.js": { type: "text/javascript", body: js },
};
const server = await startBenchServer(fx, PORT, pages);

const profile = mkdtempSync(path.join(tmpdir(), "tentacle-audio-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--no-first-run",
  "--no-default-browser-check", "--autoplay-policy=no-user-gesture-required", "about:blank",
], { stdio: "ignore" });

async function cdpTarget() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP}/json/new?http://127.0.0.1:${PORT}/page/index.html`, { method: "PUT" });
      if (res.ok) return await res.json();
    } catch {
      // Chrome démarre encore.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Chrome sans tête injoignable");
}

const target = await cdpTarget();
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
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, r));
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
}

await new Promise((r) => setTimeout(r, 800));
await evaluate("window.bench.setup()");

function analyse(rec) {
  const bytes = Buffer.from(rec.pcm, "base64");
  const samples = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
  const ref = referenceAt(path.join(fx, "album.ref.s16"), rec.sampleRate);
  return trackLag(samples, ref, rec.sampleRate);
}

const wanted = process.argv.slice(2);
const report = { capabilities: await evaluate("window.bench.capabilities()") };
if (wanted.length === 0 || wanted.includes("latency")) report.latency = await evaluate("window.bench.latency(6)");
if (wanted.length === 0 || wanted.includes("album")) {
  const r = await evaluate("window.bench.album()");
  report.album = { advanced: r.advanced, sampleRate: r.sampleRate, ...analyse(r) };
}
if (wanted.length === 0 || wanted.includes("swap")) {
  const r = await evaluate("window.bench.swap()");
  const { pcm: _pcm, startFrame: _sf, ...meta } = r;
  report.swap = { ...meta, ...analyse(r) };
}
console.log(JSON.stringify(report, null, 1));
ws.close();
chrome.kill();
server.close();
process.exit(0);
