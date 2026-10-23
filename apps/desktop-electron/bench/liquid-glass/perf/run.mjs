#!/usr/bin/env node
// Banc de fluidité du Liquid Glass (lot lg5) — BUILD DE PRODUCTION du bureau
// de ce worktree (`pnpm --filter @tentacle-tv/desktop-electron build`), jamais
// `dev` et son compteur d'images.
//
//   BANC_STATE=<état du banc> BANC_PORT_BACKEND=3115 BANC_PORT_CDP=9337 BANC_PORT_MAIN=9437 \
//     node perf/run.mjs [--configs dark-on,dark-off,light-on,light-off] [--only a,b]
//       [--player] [--admin] [--repeat 1] [--label base]
//
// Pour chaque réglage (thème × verre allumé/coupé) et chaque scénario : trace
// image par image (`frames.mjs`), GPU et CPU par processus, appels du pont
// (`probes.mjs`), charge du Mac. Le banc Electron est PARTAGÉ : on attend
// qu'AUCUN slot ne soit pris, puis on prend le nôtre (`launchApp`) ; arrêt par
// notre pid. Fenêtre au coin, sans focus (`TENTACLE_BENCH_INACTIVE=1`).
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { loadAverage } from "../lib/macos.mjs";
import { frameStats, framesOf, markWindow, startTrace, stopTrace } from "./frames.mjs";
import { bridgeRates, cpuByType, installMainProbe, mainSnapshot, startGpuSampling } from "./probes.mjs";
import { SCENARIOS } from "./scenarios.mjs";

const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};
const flag = (name) => argv.includes(name);
const configs = opt("--configs", "dark-on,dark-off,light-on,light-off").split(",");
const only = opt("--only", null)?.split(",") ?? null;
const repeat = Number(opt("--repeat", 1));
const label = opt("--label", "mesure");
const out = outDir(`lg5-${label}`);

/** Écran verrouillé : macOS ne compose plus la fenêtre, toute passe serait vide (nuit du 22/10). */
const screenLocked = () => /"CGSSessionScreenIsLocked"=Yes/.test(execFileSync("ioreg", ["-l", "-w0", "-d", "4", "-n", "Root"], { encoding: "utf8", maxBuffer: 64 << 20 }));

async function waitUnlocked() {
  // `--locked-ok` : l'Electron du banc peint quand même (`setBackgroundThrottling(false)`,
  // dessin GPU vérifié identique au 22/10) — les abandons, eux, sans WindowServer.
  if (flag("--locked-ok") || !screenLocked()) return;
  console.log("écran verrouillé : la mesure attend son déverrouillage");
  while (screenLocked()) await sleep(30_000);
}

const slots = () => readdirSync(LOCKS).filter((n) => n.startsWith("electron-slot-"));

/** Un seul Electron du banc à la fois (lg3-lecteur le partage) : on attend un banc VIDE. */
async function launchAlone(home) {
  for (;;) {
    while (slots().length > 0) await sleep(10_000);
    const app = await launchApp({ home, fresh: !flag("--keep-profile"), log: path.join(out, `${path.basename(home)}.log`) });
    if (slots().length === 1) return app;
    // Une autre session a pris l'autre slot au même instant : on lui laisse le banc.
    await stopApp(app);
    await sleep(30_000);
  }
}

async function applyConfig(app, config) {
  const [theme, glass] = config.split("-");
  // Recharger SUR l'accueil : rechargé sur /watch/…, le lecteur repartirait.
  await app.page.evaluate(`history.replaceState({}, "", "/"); localStorage.setItem("tentacle_theme_mode", ${JSON.stringify(theme)});
    localStorage.setItem("tentacle_liquid_glass", ${JSON.stringify(String(glass === "on"))}); return 1;`);
  await evalMain(app, `require("electron").nativeTheme.themeSource = ${JSON.stringify(theme)}; return 1;`);
  await app.page.evaluate("location.reload(); return 1;").catch(() => {});
  await sleep(6000);
  await app.page.send("Runtime.enable");
  await dismissOverlays(app.page);
  if (flag("--locked-ok")) await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  const mode = await app.page.evaluate("return document.documentElement.dataset.liquidGlass ?? null;");
  if ((glass === "on") !== (mode === "native")) throw new Error(`réglage ${config} : html ${mode}`);
  return mode;
}

async function measure(app, scenario, config) {
  const { page } = app;
  await waitUnlocked();
  try {
    await scenario.prep(page);
  } catch (e) {
    return { scenario: scenario.name, error: `mise en place : ${String(e?.message ?? e)}`, skipped: true };
  }
  await sleep(800);
  const before = await mainSnapshot(app, true);
  const load = loadAverage();
  await startTrace(page);
  const stopGpu = startGpuSampling(app.pid);
  // Les longues images du fil principal (≥ 50 ms, Long Animation Frames) : qui les a tenues.
  await page.evaluate(`window.__lg5Loaf = [];
    window.__lg5Obs?.disconnect();
    window.__lg5Obs = new PerformanceObserver((l) => window.__lg5Loaf.push(...l.getEntries().map((e) => ({
      ms: Math.round(e.duration), blocking: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.duration - (e.renderStart - e.startTime) : 0),
      scripts: e.scripts.slice(0, 3).map((s) => (s.invoker + " " + (s.sourceFunctionName || "") + " " + Math.round(s.duration) + "ms").slice(0, 120)),
    }))));
    window.__lg5Obs.observe({ type: "long-animation-frame" });
    performance.mark("lg5:start"); return 1;`);
  const t0 = Date.now();
  let error = null;
  try {
    await scenario.run(page);
  } catch (e) {
    error = String(e?.message ?? e);
  }
  await page.evaluate(`performance.mark("lg5:end"); return 1;`);
  const loaf = await page.evaluate(`window.__lg5Obs?.disconnect(); const l = window.__lg5Loaf ?? []; return { count: l.length, worst: [...l].sort((a, b) => b.ms - a.ms).slice(0, 4) };`).catch(() => null);
  const seconds = (Date.now() - t0) / 1000;
  const gpu = await stopGpu();
  const events = await stopTrace(page);
  const after = await mainSnapshot(app);
  if (flag("--dump")) writeFileSync(path.join(out, `${config}-${scenario.name}-${Date.now()}.trace.json`), JSON.stringify(events));
  const frames = framesOf(events);
  const stats = frameStats(frames, markWindow(events), scenario.cadenceMs ?? null);
  return { scenario: scenario.name, seconds, load, error, stats, gpu, cpu: cpuByType(before, after), bridge: bridgeRates(after, seconds), loaf, events: events.length };
}

function line(r) {
  const s = r.stats;
  return `${r.config.padEnd(10)} ${r.scenario.padEnd(19)} ${String(s.fps).padStart(5)} i/s · intervalle p95 ${s.intervalP95} p99 ${s.intervalP99} max ${s.intervalMax} ms · latence p95 ${s.frameTimeP95} ms · abandonnées ${s.dropped}/${s.expected} (${(s.droppedRatio * 100).toFixed(1)} %) rafales ${s.dropBursts} (pire ${s.longestDropRun})` +
    ` · GPU ${r.gpu.gpu.median} % (machine ${r.gpu.device.median} %) · CPU gpu ${r.cpu.GPU ?? "?"} rendu ${r.cpu.Tab ?? "?"} · ton ${r.bridge.sample?.perSecond ?? 0}/s (${r.bridge.sample?.meanMs ?? "-"} ms) · LoAF ${r.loaf?.count ?? "?"} · charge ${r.load}${r.error ? ` · ERREUR ${r.error}` : ""}`;
}

async function phase(who, scenarios, results) {
  if (scenarios.length === 0) return;
  await waitUnlocked();
  const app = await launchAlone(path.join(STATE, `home-lg5-${opt("--profile", who)}`));
  try {
    await connectAndLogin(app.page, { server: SERVER, ...account(who) });
    await sleep(4000);
    await dismissOverlays(app.page);
    console.log(`sondes du principal : ${await installMainProbe(app)}`);
    if (flag("--locked-ok")) await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
    for (const config of configs) {
      const mode = await applyConfig(app, config);
      for (let k = 0; k < repeat; k += 1) {
        for (const scenario of scenarios) {
          const r = { config, mode, pass: k, ...(await measure(app, scenario, config)) };
          results.push(r);
          console.log(r.skipped ? `${config.padEnd(10)} ${r.scenario.padEnd(19)} SAUTÉ — ${r.error}` : line(r));
          writeFileSync(path.join(out, "rapport.json"), `${JSON.stringify({ date: new Date().toISOString(), results }, null, 2)}\n`);
        }
      }
    }
  } finally {
    await stopApp(app);
  }
}

const wanted = SCENARIOS.filter((s) => (only === null || only.includes(s.name)) && (!s.player || flag("--player")) && (s.account !== "admin" || flag("--admin")));
const results = [];
console.log(`banc lg5 → ${out} · scénarios ${wanted.map((s) => s.name).join(", ")} · réglages ${configs.join(", ")}`);
await phase("Knaoxtest", wanted.filter((s) => s.account !== "admin"), results);
await phase("admin", wanted.filter((s) => s.account === "admin"), results);
console.log(`rapport : ${path.join(out, "rapport.json")}`);
