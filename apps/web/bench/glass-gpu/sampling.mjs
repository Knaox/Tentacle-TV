/**
 * Relevés GPU et CPU d'un Electron et de WindowServer, SANS sudo : le temps
 * GPU cumulé par processus (ioreg, clients AGX) et le %CPU (ps). Partagé par
 * le banc de la page (`run-bench.mjs`) et le passage sur l'application
 * réelle (`app-lens.mjs`).
 */

import { execFileSync } from "node:child_process";

import { gpuBusyPercent, parseAgxGpuTime, summarize } from "../../src/theme/glass/gpuBudget.ts";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** L'arbre de processus d'Electron (principal, rendu, GPU) et son %CPU cumulé. */
export function processTree(rootPid) {
  const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,%cpu="], { encoding: "utf8" })
    .trim()
    .split("\n")
    .map((l) => l.trim().split(/\s+/).map(Number));
  const pids = new Set([rootPid]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const [pid, ppid] of rows) {
      if (pids.has(ppid) && !pids.has(pid)) {
        pids.add(pid);
        grew = true;
      }
    }
  }
  const cpu = rows.filter(([pid]) => pids.has(pid)).reduce((s, [, , c]) => s + c, 0);
  return { pids, cpu };
}

const windowServerPid = () => Number(execFileSync("pgrep", ["-x", "WindowServer"], { encoding: "utf8" }).trim().split("\n")[0]);

export const agx = () =>
  parseAgxGpuTime(execFileSync("ioreg", ["-l", "-w0", "-r", "-c", "AGXDeviceUserClient"], { encoding: "utf8", maxBuffer: 64 << 20 }));

/**
 * Relevés toutes les 500 ms : occupation GPU d'Electron (sa page) et de
 * WindowServer (composition, flou natif), %CPU d'Electron.
 */
export async function sample(durationMs, rootPid) {
  const app = [];
  const server = [];
  const cpu = [];
  const ws = windowServerPid();
  let before = agx();
  let t0 = performance.now();
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    await sleep(500);
    const after = agx();
    const t1 = performance.now();
    const tree = processTree(rootPid);
    app.push(gpuBusyPercent(before, after, tree.pids, t1 - t0));
    server.push(gpuBusyPercent(before, after, [ws], t1 - t0));
    cpu.push(tree.cpu);
    before = after;
    t0 = t1;
  }
  return { app, server, cpu };
}

export const summarizePass = (raw) => ({ gpu: summarize(raw.app), windowServer: summarize(raw.server), cpu: summarize(raw.cpu) });
