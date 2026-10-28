/**
 * Le pont du moteur audio dans le VRAI Electron : preload (liste fermée des
 * canaux), schémas zod, garde des sources, moteur dans le principal, évènements
 * jusqu'à la page. La page ne contient pas encore l'interface Octave : on
 * appelle `window.tentacle` comme l'adaptateur (`music/engine/mpv/`) le fait.
 *
 *   pnpm --filter @tentacle-tv/desktop-electron build:ts
 *   BENCH_DIR=<témoins> node apps/desktop-electron/bench/audio/electronSmoke.mjs
 *
 * Verrou du lot (un Electron à la fois), profil jetable (`CFFIXED_USER_HOME`),
 * fenêtre jamais active (`TENTACLE_BENCH_INACTIVE`), réduite dès qu'elle paraît ;
 * CDP 9232 ; arrêt par NOTRE pid. Volume 0,05 (−78 dB).
 */

import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { benchDir, generate } from "./fixtures.mjs";
import { startBenchServer } from "./serve.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, "../..");
const ELECTRON = path.resolve(DESKTOP, "../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const LOCK = "/Users/damienrouge/Desktop/Projet - local/.claude/octave/locks/electron";
const CDP = 9232;
const ORIGIN = "http://127.0.0.1:3102";

for (;;) {
  try {
    mkdirSync(LOCK);
    break;
  } catch {
    console.log("[banc] Electron occupé (verrou du lot) : j'attends");
    await new Promise((r) => setTimeout(r, 10_000));
  }
}

const fx = generate(benchDir("audio"));
const server = await startBenchServer(fx, 3102);
const home = mkdtempSync(path.join(tmpdir(), "tentacle-audio-home-"));
mkdirSync(path.join(home, "Library/Application Support"), { recursive: true });
const child = spawn(ELECTRON, [".", `--remote-debugging-port=${CDP}`], {
  cwd: DESKTOP,
  env: { ...process.env, CFFIXED_USER_HOME: home, TENTACLE_SANS_DEVTOOLS: "1", TENTACLE_BENCH_INACTIVE: "1", TENTACLE_MPV_LIB: "livree" },
  stdio: ["ignore", "ignore", "pipe"],
});
let stderr = "";
child.stderr.on("data", (d) => (stderr += String(d)));
const rssMiB = () => Math.round(Number(execFileSync("ps", ["-o", "rss=", "-p", String(child.pid)]).toString().trim()) / 102.4) / 10;

const report = {};
try {
  let target = null;
  for (let i = 0; i < 150 && target === null; i += 1) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP}/json`)).json();
      target = list.find((t) => t.type === "page" && t.url.startsWith("tentacle://")) ?? null;
    } catch {
      // Electron démarre encore.
    }
  }
  if (target === null) throw new Error("page tentacle:// introuvable");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 1;
  const pending = new Map();
  ws.addEventListener("message", (m) => {
    const msg = JSON.parse(String(m.data));
    pending.get(msg.id)?.(msg);
  });
  const send = (method, params = {}) => new Promise((r) => { const n = id++; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const run = async (js) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true });
    return r.result?.exceptionDetails ? { thrown: r.result.exceptionDetails.exception?.description?.split("\n")[0] } : r.result?.result?.value;
  };
  // Réduite dès qu'elle paraît : rien ne reste devant l'utilisateur.
  const win = await send("Browser.getWindowForTarget", {});
  report.minimized = win.result ? (await send("Browser.setWindowBounds", { windowId: win.result.windowId, bounds: { windowState: "minimized" } })).error === undefined : false;
  await new Promise((r) => setTimeout(r, 1500));

  report.declared = await run(`return ["audio_engine_start","audio_play","audio_swap_source","audio_control"].every((c) => window.tentacle.capabilities.includes(c));`);
  report.rssBeforeMiB = rssMiB();
  report.capabilities = await run(`
    window.__ev = []; window.tentacle.on("audio://event", (e) => window.__ev.push([performance.now(), e]));
    return await window.tentacle.invoke("audio_engine_start", { serverOrigin: "${ORIGIN}", headers: { "X-Emby-Token": "bench" },
      volume: 0.05, muted: false, replayGain: "auto", deviceId: null, exclusive: false });`);
  report.rssIdleMiB = rssMiB();
  const T = (k, d) => `{ trackKey: "${k}", albumKey: "banc", durationMs: ${d}, format: null }`;
  const S = (url, origin = "library", complete = true) => `{ url: "${url}", origin: "${origin}", complete: ${complete}, sizeBytes: null, durationMs: null, replayGain: null, expiresAt: null }`;
  report.refusedFile = await run(`return await window.tentacle.invoke("audio_play", { track: ${T("x", 1)}, source: ${S("file:///etc/hosts")}, startMs: 0 }).then(() => "accepté", (e) => String(e).slice(0, 120));`);
  report.refusedOtherHost = await run(`return await window.tentacle.invoke("audio_play", { track: ${T("x", 1)}, source: ${S("http://example.com/a.flac")}, startMs: 0 }).then(() => "accepté", (e) => String(e).slice(0, 120));`);
  report.refusedSchema = await run(`return await window.tentacle.invoke("audio_control", { action: "volume", value: 7 }).then(() => "accepté", (e) => String(e).slice(0, 120));`);
  report.flow = await run(`
    const wait = (p, ms) => new Promise((ok) => { const t0 = performance.now(); const tick = () => p() || performance.now() - t0 > ms ? ok(p()) : setTimeout(tick, 10); tick(); });
    const t0 = performance.now();
    await window.tentacle.invoke("audio_play", { track: ${T("t1", 4000)}, source: ${S(`${ORIGIN}/grow/album-1.flac?mode=hold&rate=266000&head=150000&key=el`, "plugin", false)}, startMs: 0 });
    await window.tentacle.invoke("audio_set_next", { track: ${T("t2", 4002)}, source: ${S(`${ORIGIN}/files/album-2.flac`)} });
    await wait(() => window.__ev.some(([, e]) => e.type === "state" && e.state.status === "playing"), 5000);
    const playingMs = Math.round((window.__ev.find(([, e]) => e.type === "state" && e.state.status === "playing")?.[0] ?? NaN) - t0);
    await window.tentacle.invoke("audio_swap_source", { trackKey: "t1", source: ${S(`${ORIGIN}/files/album-1.flac`)} });
    await wait(() => window.__ev.some(([, e]) => e.type === "advanced"), 10000);
    const kinds = window.__ev.map(([, e]) => e.type === "state" ? "state:" + e.state.status : e.type).filter((k, i, a) => k !== a[i - 1]);
    const last = window.__ev.filter(([, e]) => e.type === "state").at(-1)?.[1].state;
    return { playingMs, kinds, lastFormat: last?.format ?? null, lastTrack: last?.trackKey ?? null };`);
  report.rssPlayingMiB = rssMiB();
  report.outputs = await run(`return await window.tentacle.invoke("audio_list_outputs", {});`);
  report.exclusive = await run(`
    await window.tentacle.invoke("audio_set_output", { deviceId: "auto", exclusive: true });
    const on = window.__ev.filter(([, e]) => e.type === "state").at(-1)?.[1].state.output;
    await window.tentacle.invoke("audio_set_output", { deviceId: null, exclusive: false });
    return on;`);
  report.stop = await run(`await window.tentacle.invoke("audio_engine_stop", {}); return "ok";`);
  await new Promise((r) => setTimeout(r, 500));
  report.rssAfterStopMiB = rssMiB();
  report.mainLog = stderr.split("\n").filter((l) => /\[audio\]|\[mpv\]/.test(l)).slice(0, 12);
  ws.close();
} catch (error) {
  report.error = String(error);
} finally {
  child.kill();
  server.close();
  try { rmdirSync(LOCK); } catch { /* déjà rendu */ }
}
console.log(JSON.stringify(report, null, 1));
process.exit(0);
