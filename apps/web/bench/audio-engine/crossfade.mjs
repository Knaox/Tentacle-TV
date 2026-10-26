/**
 * Le banc de la TRANSITION DOUCE du moteur `<audio>` : un Chrome sans tête (CDP), le son des éléments
 * enregistré dans la page (AudioWorklet), jamais par les haut-parleurs (`--disable-audio-output`).
 *
 *   node apps/web/bench/audio-engine/crossfade.mjs
 *
 * `CHROME` (défaut : le Chrome de puppeteer), `PORT` (serveur des fichiers, défaut 5722), `CDP` (défaut 9382).
 */

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { startBenchServer } from "../../../desktop-electron/bench/audio/serve.mjs";
import { analyseCrossfade, analyseCut } from "./crossfadeAnalysis.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5722);
const CDP = Number(process.env.CDP ?? 9382);

function puppeteerChrome() {
  const root = path.join(homedir(), ".cache/puppeteer/chrome");
  const version = existsSync(root) ? readdirSync(root).sort().at(-1) : null;
  return version ? path.join(root, version, "chrome-linux64/chrome") : "google-chrome";
}
const CHROME = process.env.CHROME ?? puppeteerChrome();

/** Deux tons de 40 s (un fondu de 12 s tient dans le tiers de chacun), même niveau (−10,5 dBFS), A à 440 Hz, B à 660 Hz. */
export function tones(dir) {
  mkdirSync(dir, { recursive: true });
  // `silence` : le titre choisi par un geste, muet — seule la sortie de A s'entend, le clic se mesure seul.
  for (const [name, expr] of [["tone-a", "0.3*sin(2*PI*440*t)"], ["tone-b", "0.3*sin(2*PI*660*t)"], ["silence", "0"]]) {
    const out = path.join(dir, `${name}.flac`);
    if (!existsSync(out)) execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", `aevalsrc=${expr}:s=48000:d=40`, "-ac", "2", "-c:a", "flac", out]);
  }
  return dir;
}

const dir = tones(process.env.BENCH_DIR ?? path.join(tmpdir(), "tentacle-crossfade-bench"));
const bundle = await build({ entryPoints: [path.join(here, "crossfadePage.ts")], bundle: true, write: false, format: "esm", target: "es2022", logLevel: "silent" });
const pages = {
  "index.html": { type: "text/html", body: '<!doctype html><meta charset="utf-8"><script type="module" src="/page/bench.js"></script>' },
  "bench.js": { type: "text/javascript", body: bundle.outputFiles[0].text },
};
const server = await startBenchServer(dir, PORT, pages);
const profile = mkdtempSync(path.join(tmpdir(), "tentacle-crossfade-chrome-"));
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${CDP}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
  "--autoplay-policy=no-user-gesture-required", "--disable-audio-output", "about:blank",
], { stdio: "ignore", env: { ...process.env, PULSE_SERVER: "unix:/nonexistent" } });

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

const samplesOf = (rec, name = "rec") => {
  const bytes = Buffer.from(rec.pcm, "base64");
  // `SAVE_DIR` : l'enregistrement brut (f32, mono) gardé pour une analyse à la main.
  if (process.env.SAVE_DIR) writeFileSync(path.join(process.env.SAVE_DIR, `${name}-${rec.sampleRate}.f32`), bytes);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
};
const marks = (rec) => rec.marks.map((m) => `${m.type}@${(m.frame / rec.sampleRate).toFixed(2)}s`);

await new Promise((r) => setTimeout(r, 800));
await evaluate("window.bench.setup()");
const wanted = process.argv.slice(2);
const want = (name) => wanted.length === 0 || wanted.includes(name);
const report = {};
for (const ms of [2_000, 6_000, 12_000]) {
  if (!want(`fade${ms / 1000}`)) continue;
  const rec = await evaluate(`window.bench.fade(${ms}, false, ${ms / 1000 + 3})`);
  report[`fade${ms / 1000}s`] = { ...analyseCrossfade(samplesOf(rec, `fade${ms / 1000}`), rec.sampleRate, { expectedS: ms / 1000 }), marks: marks(rec) };
}
if (want("album")) {
  const rec = await evaluate("window.bench.fade(6000, true, 9)");
  const { envelope: _e, ...rest } = analyseCrossfade(samplesOf(rec, "album"), rec.sampleRate, { expectedS: 0 });
  report.sameAlbum = { ...rest, marks: marks(rec) };
}
if (want("manual")) {
  const rec = await evaluate("window.bench.manual(6000)");
  report.manualCut = { ...analyseCut(samplesOf(rec, "manual"), rec.sampleRate), marks: marks(rec) };
  // Témoin : transition douce coupée, le titre quitté est lâché net (le comportement d'avant).
  const off = await evaluate("window.bench.manual(0)");
  report.manualCutOff = analyseCut(samplesOf(off, "manual-off"), off.sampleRate);
}
if (want("pause")) {
  const rec = await evaluate("window.bench.pauseMid(6000)");
  const { envelope: _e, ...rest } = analyseCrossfade(samplesOf(rec, "pause"), rec.sampleRate, { expectedS: 6, pause: true });
  report.pauseMid = { ...rest, marks: marks(rec) };
}
if (want("pausePlain")) {
  const rec = await evaluate("window.bench.pausePlain()");
  samplesOf(rec, "pause-plain");
  report.pausePlain = "enregistré (SAVE_DIR)";
}
console.log(JSON.stringify(report, null, 1));
ws.close();
chrome.kill();
server.close();
process.exit(0);
