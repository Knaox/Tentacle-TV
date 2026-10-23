// Banc de fluidité (lot lg5) : ce qui se relève À CÔTÉ des images.
//  - le GPU par processus (ioreg, clients AGX, sans sudo) et le CPU de
//    l'arbre d'Electron, toutes les 500 ms, du début à la fin d'un geste ;
//  - le processeur de CHAQUE processus d'Electron (`app.getAppMetrics`,
//    le processus GPU à part) ;
//  - la fréquence et la durée des appels du pont du verre : mesures de ton
//    (`liquidGlass.sample` → `capturePage`) et mises à jour des régions natives.
import { gpuBusyPercent, summarize } from "../../../../web/src/theme/glass/gpuBudget.ts";
import { agx, processTree } from "../../../../web/bench/glass-gpu/sampling.mjs";
import { evalMain } from "../lib/electron.mjs";
import { gpuSample } from "../lib/macos.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Les canaux du pont (`protocol.ts`) : régions natives, puis mesure du ton. */
const CHANNELS = ["tentacle:liquid-glass", "tentacle:liquid-glass-sample"];

/**
 * Pose, une fois, les compteurs du principal : chaque canal du pont est
 * enveloppé (appels, durée cumulée, pire durée). Rien n'est changé à ce que
 * fait le pont ; ce code ne vit que dans l'Electron du banc.
 */
export async function installMainProbe(app) {
  return evalMain(app, `
    const { ipcMain } = require("electron");
    if (globalThis.__lg5) return Object.keys(globalThis.__lg5.counters);
    const counters = {};
    for (const ch of ${JSON.stringify(CHANNELS)}) {
      const c = (counters[ch] = { calls: 0, ms: 0, max: 0, via: "none" });
      const handlers = ipcMain._invokeHandlers;
      const h = handlers?.get?.(ch);
      if (h) {
        c.via = "handle";
        handlers.set(ch, async (...a) => {
          c.calls += 1;
          const t = performance.now();
          try { return await h(...a); } finally { const d = performance.now() - t; c.ms += d; c.max = Math.max(c.max, d); }
        });
      } else {
        c.via = "on";
        ipcMain.prependListener(ch, () => { c.calls += 1; });
      }
    }
    globalThis.__lg5 = { counters };
    return Object.entries(counters).map(([k, v]) => k + ":" + v.via);
  `);
}

/** Remet les compteurs du pont à zéro et rend l'état du processeur de chaque processus. */
export async function mainSnapshot(app, reset = false) {
  return evalMain(app, `
    const { app } = require("electron");
    const counters = globalThis.__lg5?.counters ?? {};
    const out = JSON.parse(JSON.stringify(counters));
    if (${reset}) for (const c of Object.values(counters)) { c.calls = 0; c.ms = 0; c.max = 0; }
    const metrics = app.getAppMetrics().map((m) => ({ pid: m.pid, type: m.type, cum: m.cpu.cumulativeCPUUsage ?? null, pct: m.cpu.percentCPUUsage }));
    return { at: Date.now(), counters: out, metrics };
  `);
}

/** Le CPU de chaque type de processus entre deux relevés (en % d'un cœur). */
export function cpuByType(before, after) {
  const seconds = (after.at - before.at) / 1000;
  const out = {};
  for (const m of after.metrics) {
    const prev = before.metrics.find((p) => p.pid === m.pid);
    const pct = prev && m.cum !== null && prev.cum !== null ? ((m.cum - prev.cum) / seconds) * 100 : m.pct;
    out[m.type] = Math.round(((out[m.type] ?? 0) + pct) * 10) / 10;
  }
  return out;
}

/** Les appels du pont pendant la fenêtre, par seconde, et leur durée. */
export function bridgeRates(after, seconds) {
  const out = {};
  for (const [ch, c] of Object.entries(after.counters)) {
    const name = ch.endsWith("-sample") ? "sample" : "regions";
    out[name] = { perSecond: Math.round((c.calls / seconds) * 100) / 100, calls: c.calls, meanMs: c.calls ? Math.round((c.ms / c.calls) * 10) / 10 : null, maxMs: Math.round(c.max * 10) / 10 };
  }
  return out;
}

/** Relevé GPU/CPU par pas de 500 ms jusqu'à `stop()` : rend les résumés. */
export function startGpuSampling(rootPid) {
  const app = [];
  const cpu = [];
  const device = [];
  let running = true;
  const loop = (async () => {
    let before = agx();
    let t0 = performance.now();
    while (running) {
      await sleep(500);
      const after = agx();
      const t1 = performance.now();
      const tree = processTree(rootPid);
      app.push(gpuBusyPercent(before, after, tree.pids, t1 - t0));
      cpu.push(tree.cpu);
      // Toute la machine (« Device Utilization % ») : à comparer dans une même passe seulement.
      const d = gpuSample().device;
      if (Number.isFinite(d)) device.push(d);
      before = after;
      t0 = t1;
    }
  })();
  return async () => {
    running = false;
    await loop;
    return { gpu: summarize(app), cpuTree: summarize(cpu), device: summarize(device) };
  };
}
