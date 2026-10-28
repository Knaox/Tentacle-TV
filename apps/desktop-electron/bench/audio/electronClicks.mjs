/**
 * 20 clics dans le VRAI Electron, comme le lecteur Octave les fait : la source
 * du titre demandée au serveur Tentacle (`/api/music/source/:id`), `audio_play`
 * par le pont, puis `audio_set_next` une fois le titre en lecture. Mesure : clic
 * → état « playing » reçu par la page (le son suit de ~35 ms, la latence de
 * CoreAudio). `TENTACLE_AUDIO_MPV_LOG` : le journal de l'instance audio.
 *
 *   CLICK_BASE=http://127.0.0.1:3102 CLICK_TOKEN=<jeton du compte de test> \
 *     node apps/desktop-electron/bench/audio/electronClicks.mjs
 *
 * Verrou du lot, profil jetable, fenêtre jamais active, CDP 9232, arrêt par
 * NOTRE pid. Volume 0,05 (−78 dB).
 */

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP = path.resolve(HERE, "../..");
const ELECTRON = path.resolve(DESKTOP, "../../node_modules/electron/dist/Electron.app/Contents/MacOS/Electron");
const LOCK = "/Users/damienrouge/Desktop/Projet - local/.claude/octave/locks/electron";
const ENV_FILE = process.env.OCTAVE_BENCH_ENV ?? "/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/jellyfin.env";
const ALBUMS = new Set(["Enchaînement continu", "Formats témoins", "Duos d'été", "Bright Piano Works", "Elegant Piano", "Polka! Polka! Polka!"]);
const BASE = process.env.CLICK_BASE ?? "http://127.0.0.1:3102";
const TOKEN = process.env.CLICK_TOKEN ?? "";
const COUNT = Number(process.env.CLICKS ?? 20);
const CDP = 9232;

const env = Object.fromEntries(readFileSync(ENV_FILE, "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const list = await (await fetch(`${env.OCTAVE_JELLYFIN_URL}/Users/${env.OCTAVE_OCTAVE1_ID}/Items?Recursive=true&IncludeItemTypes=Audio&SortBy=Album,IndexNumber`, { headers: { "X-Emby-Token": env.OCTAVE_OCTAVE1_TOKEN } })).json();
const items = list.Items.filter((i) => ALBUMS.has(i.Album));

for (;;) {
  try { mkdirSync(LOCK); break; } catch { await new Promise((r) => setTimeout(r, 10_000)); }
}
const home = mkdtempSync(path.join(tmpdir(), "tentacle-audio-home-"));
mkdirSync(path.join(home, "Library/Application Support"), { recursive: true });
const child = spawn(ELECTRON, [".", `--remote-debugging-port=${CDP}`], {
  cwd: DESKTOP,
  env: { ...process.env, CFFIXED_USER_HOME: home, TENTACLE_SANS_DEVTOOLS: "1", TENTACLE_BENCH_INACTIVE: "1", TENTACLE_MPV_LIB: "livree" },
  stdio: "ignore",
});

const report = { clicks: [] };
try {
  let target = null;
  for (let i = 0; i < 150 && target === null; i += 1) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      target = (await (await fetch(`http://127.0.0.1:${CDP}/json`)).json()).find((t) => t.type === "page" && t.url.startsWith("tentacle://")) ?? null;
    } catch { /* Electron démarre */ }
  }
  if (target === null) throw new Error("page tentacle:// introuvable");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 1;
  const pending = new Map();
  // Seules les réponses à NOS requêtes (identifiant numérique) : un évènement n'appelle rien.
  ws.addEventListener("message", (m) => { const msg = JSON.parse(String(m.data)); if (typeof msg.id === "number") pending.get(msg.id)?.(msg); });
  const run = (js) => new Promise((r) => { const n = id++; pending.set(n, r); ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression: `(async () => { ${js} })()`, awaitPromise: true, returnByValue: true } })); })
    .then((r) => (r.result?.exceptionDetails ? { thrown: r.result.exceptionDetails.exception?.description?.split("\n")[0] } : r.result?.result?.value));
  await new Promise((r) => setTimeout(r, 1500));
  await run(`window.__ev = []; window.tentacle.on("audio://event", (e) => window.__ev.push([performance.now(), e]));
    await window.tentacle.invoke("audio_engine_start", { serverOrigin: ${JSON.stringify(new URL(BASE).origin)}, headers: { "X-Emby-Token": ${JSON.stringify(TOKEN)} },
      volume: 0.05, muted: false, replayGain: "auto", deviceId: null, exclusive: false }); return true;`);
  const bridge = async (itemId) => {
    const s = await (await fetch(`${BASE}/api/music/source/${itemId}`, { headers: { "X-Emby-Token": TOKEN } })).json();
    return { url: `${BASE}${s.url}`, origin: s.origin, complete: s.complete, sizeBytes: s.sizeBytes, durationMs: s.durationMs, replayGain: s.replayGain, expiresAt: s.expiresAt };
  };
  for (let i = 0; i < COUNT; i += 1) {
    // Tous les 5 clics : arrêt, puis 15 s de silence (sortie fermée, périphérique au repos).
    const idle = i > 0 && i % 5 === 0;
    if (idle) {
      await run(`await window.tentacle.invoke("audio_control", { action: "stop" }); return true;`);
      await new Promise((r) => setTimeout(r, 15_000));
    } else await new Promise((r) => setTimeout(r, 1500 + ((i * 977) % 2500)));
    const item = items[(i * 7) % items.length];
    const next = items[(i * 7 + 1) % items.length];
    const tFetch = performance.now();
    const source = await bridge(item.Id);
    const nextSource = await bridge(next.Id);
    const fetchMs = Math.round(performance.now() - tFetch);
    const key = `${item.Id}#${i}`;
    const r = await run(`
      const t0 = performance.now();
      await window.tentacle.invoke("audio_play", { track: { trackKey: "${key}", albumKey: "${item.AlbumId ?? ""}", durationMs: null, format: null }, source: ${JSON.stringify(source)}, startMs: 0 });
      const playing = () => window.__ev.find(([t, e]) => t >= t0 && e.type === "state" && e.state.trackKey === "${key}" && e.state.status === "playing");
      while (!playing() && performance.now() - t0 < 6000) await new Promise((ok) => setTimeout(ok, 2));
      const p = playing();
      if (p) await window.tentacle.invoke("audio_set_next", { track: { trackKey: "${next.Id}#n${i}", albumKey: null, durationMs: null, format: null }, source: ${JSON.stringify(nextSource)} });
      return { playingMs: p ? Math.round(p[0] - t0) : null };`);
    report.clicks.push({ i, afterIdle: idle, at: new Date().toISOString().slice(11, 23), name: `${item.Album} — ${item.Name}`, fetchMs, ...r });
  }
  await run(`await window.tentacle.invoke("audio_engine_stop", {}); return true;`);
  ws.close();
} catch (error) {
  report.error = String(error);
} finally {
  child.kill();
  try { rmdirSync(LOCK); } catch { /* rendu */ }
}
const v = report.clicks.map((c) => c.playingMs ?? 9999).sort((a, z) => a - z);
report.median = v[Math.floor(v.length / 2)];
report.max = v.at(-1);
report.over500 = report.clicks.filter((c) => (c.playingMs ?? 9999) > 500).length;
console.log(JSON.stringify(report, null, 1));
process.exit(0);
