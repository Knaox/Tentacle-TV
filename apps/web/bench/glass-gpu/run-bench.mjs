#!/usr/bin/env node
/**
 * Banc GPU du « liquide » du verre — rejouable, sans sudo.
 *
 *   node apps/web/bench/glass-gpu/run-bench.mjs [--seconds 8] [--repeat 1] [--out fichier.json]
 *        [--cdp 9306] [--lock-dir <dossier des créneaux Electron du lot>]
 *
 * 1. Construit la page du banc EN PRODUCTION (vite build, dossier temporaire).
 * 2. L'ouvre dans l'Electron du dépôt, fenêtre visible, CDP sur 9306
 *    (verrou d'un créneau Electron du lot, rendu à la fin).
 * 3. Pour chaque scénario, deux passes identiques — physique COUPÉE
 *    (référence), puis ALLUMÉE — mesurées par le temps GPU de chaque processus
 *    (`ioreg`, clients AGX, toutes les 500 ms) : le verdict est l'écart de
 *    médiane du GPU d'Electron (`gpuBudget.ts`) ; WindowServer et le CPU sont
 *    relevés à côté.
 *
 * Mac au calme pendant la mesure (rien d'autre à l'écran ne bouge).
 */

import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { GPU_BUDGETS, judgeScenario } from "../../src/theme/glass/gpuBudget.ts";
import { agx, processTree, sample, summarizePass } from "./sampling.mjs";
import { scenarioDriver } from "./scenarios.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "../..");
const args = new Map(process.argv.slice(2).map((a, i, all) => [a, all[i + 1]]).filter(([a]) => a.startsWith("--")));
const seconds = Number(args.get("--seconds") ?? 8);
const repeat = Number(args.get("--repeat") ?? 1);
const cdpPort = Number(args.get("--cdp") ?? 9306);
// Dossier des verrous du lot (créneaux Electron) : `--lock-dir` ou LG_LOCK_DIR ;
// sans lui, aucun verrou (banc lancé seul).
const lockDir = args.get("--lock-dir") ?? process.env.LG_LOCK_DIR;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function takeElectronSlot() {
  if (!lockDir) return null;
  for (const slot of ["electron-slot-1", "electron-slot-2"]) {
    try {
      mkdirSync(join(lockDir, slot));
      return join(lockDir, slot);
    } catch {
      /* créneau pris */
    }
  }
  throw new Error("aucun créneau Electron libre (2 au plus pour le lot)");
}

async function cdp(port) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = pages.find((p) => p.type === "page");
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((res, rej) => ((ws.onopen = res), (ws.onerror = rej)));
        let id = 0;
        const pending = new Map();
        ws.onmessage = (e) => {
          const msg = JSON.parse(e.data);
          // Seules les réponses à NOS requêtes (identifiant numérique) : un évènement n'appelle rien.
          if (typeof msg.id === "number") pending.get(msg.id)?.(msg);
          pending.delete(msg.id);
        };
        const send = (method, params = {}) =>
          new Promise((res) => {
            id += 1;
            pending.set(id, res);
            ws.send(JSON.stringify({ id, method, params }));
          });
        return { send, close: () => ws.close() };
      }
    } catch {
      /* Electron démarre */
    }
    await sleep(200);
  }
  throw new Error("CDP injoignable");
}

/** Images réellement produites en une seconde (requestAnimationFrame). */
const FRAME_RATE_PROBE = `new Promise((res) => { let n = 0; const t0 = performance.now();
  const f = () => { n += 1; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); };
  requestAnimationFrame(f); })`;


async function main() {
  const outDir = mkdtempSync(join(tmpdir(), "lg-gpu-bench-"));
  execFileSync("pnpm", ["exec", "vite", "build", "--config", join(here, "bench/vite.config.ts"), "--outDir", outDir], {
    cwd: webRoot,
    stdio: "inherit",
  });
  const electron = createRequire(join(webRoot, "../desktop-electron/package.json"))("electron");
  const slot = takeElectronSlot();
  const child = spawn(electron, [join(here, "bench/electron-main.mjs"), `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${join(outDir, "profile")}`], {
    env: { ...process.env, BENCH_URL: pathToFileURL(join(outDir, "index.html")).href },
    stdio: "ignore",
  });
  const results = [];
  try {
    const page = await cdp(cdpPort);
    const evaluate = (expression) => page.send("Runtime.evaluate", { expression, awaitPromise: true });
    while (!(await evaluate("window.__bench?.ready === true")).result?.result?.value) await sleep(100);
    // Garde : une fenêtre que macOS ne compose pas (écran verrouillé ou éteint,
    // fenêtre masquée) ne produit aucune image — la mesure vaudrait 0 % partout,
    // un faux « ✓ ». On exige une vraie cadence avant de mesurer quoi que ce soit.
    const fps = (await evaluate(FRAME_RATE_PROBE)).result?.result?.value ?? 0;
    if (fps < 30) throw new Error(`fenêtre non rendue (${fps} images/s) : écran verrouillé, éteint ou fenêtre masquée — mesure impossible`);
    console.log(`fenêtre rendue à ${fps} images/s`);
    if (args.has("--debug")) {
      // Diagnostic : quels processus d'Electron ont un client GPU, et combien.
      const map = agx();
      const names = execFileSync("ps", ["-A", "-o", "pid=,comm="], { encoding: "utf8" });
      for (const pid of processTree(child.pid).pids) {
        const name = names.split("\n").find((l) => l.trim().startsWith(`${pid} `))?.trim() ?? pid;
        console.log(`  ${name} — GPU cumulé ${map.get(pid) ?? "aucun client AGX"}`);
      }
    }
    // Calibration : une animation connue (fusion, physique coupée) DOIT se voir
    // au GPU d'Electron. Relevé du 21/10 : une passe entière à 0 % partout,
    // fenêtre pourtant rendue — le temps GPU n'était plus compté à Electron.
    // Sans cette garde, ce zéro passait pour un verdict « ✓ ».
    const calibration = scenarioDriver("fusion", page.send, evaluate);
    await calibration.setup(false);
    const stopCalibration = calibration.start();
    const agxBefore = agx();
    const calibrated = summarizePass(await sample(3000, child.pid));
    const agxAfter = agx();
    await stopCalibration();
    if (!(calibrated.gpu.median > 1)) {
      // À qui macOS a-t-il imputé le temps GPU ? Les cinq processus qui ont le plus bougé.
      const names = execFileSync("ps", ["-A", "-o", "pid=,comm="], { encoding: "utf8" }).split("\n");
      const movers = [...agxAfter]
        .map(([pid, ns]) => [pid, ns - (agxBefore.get(pid) ?? 0)])
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [pid, ns] of movers) {
        const name = names.find((l) => l.trim().startsWith(`${pid} `))?.trim().slice(0, 140) ?? pid;
        console.error(`  ${Math.round(ns / 1e6)} ms GPU — ${name}${processTree(child.pid).pids.has(pid) ? " (Electron du banc)" : ""}`);
      }
      throw new Error(`calibration : ${calibrated.gpu.median} % de GPU pour une animation connue — temps GPU d'Electron non compté, mesure impossible`);
    }
    console.log(`calibration : animation connue à ${calibrated.gpu.median} % du GPU d'Electron`);
    for (const scenario of Object.keys(GPU_BUDGETS)) {
      // Passes coupée / allumée ALTERNÉES `repeat` fois : une dérive de la
      // charge du Mac pèse autant sur l'une que sur l'autre.
      const raw = { off: { app: [], server: [], cpu: [] }, on: { app: [], server: [], cpu: [] } };
      for (let r = 0; r < repeat; r += 1) {
        for (const physics of [false, true]) {
          const drive = scenarioDriver(scenario, page.send, evaluate);
          await drive.setup(physics);
          await sleep(1500);
          const stop = drive.start();
          const pass = await sample(seconds * 1000, child.pid);
          await stop();
          for (const k of ["app", "server", "cpu"]) raw[physics ? "on" : "off"][k].push(...pass[k]);
        }
      }
      const passes = { off: summarizePass(raw.off), on: summarizePass(raw.on) };
      const verdict = judgeScenario(scenario, passes.on.gpu, passes.off.gpu);
      results.push({ ...verdict, reference: passes.off, measured: passes.on });
      console.log(
        `${verdict.ok ? "✓" : "✗"} ${scenario.padEnd(13)} GPU Electron ${passes.off.gpu.median} → ${passes.on.gpu.median} % (écart ${verdict.delta}` +
          `${verdict.gestureMs === undefined ? "" : ` = ${verdict.gestureMs} ms/geste`}, budget ${verdict.limit} ${verdict.unit})` +
          ` · WindowServer ${passes.off.windowServer.median} → ${passes.on.windowServer.median} % · CPU ${passes.off.cpu.median} → ${passes.on.cpu.median} %`,
      );
    }
    page.close();
  } finally {
    child.kill();
    if (slot) rmdirSync(slot);
  }
  const report = { date: new Date().toISOString(), seconds, repeat, load: execFileSync("uptime", { encoding: "utf8" }).trim(), source: "ioreg AGXDeviceUserClient accumulatedGPUTime (Electron, WindowServer) ; CPU = ps", results };
  if (args.get("--out")) writeFileSync(args.get("--out"), `${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 2;
});
