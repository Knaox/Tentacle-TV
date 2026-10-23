#!/usr/bin/env node
// Banc de fluidité (lot lg5) : recalcule le verdict des traces gardées
// (`run.mjs --dump`), sans relancer Electron. `node perf/analyze.mjs <dossier>`.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { frameStats, framesOf, markWindow } from "./frames.mjs";

const dir = process.argv[2];
const AMBIENT = new Set(["repos-accueil", "rotation-heros"]);
for (const file of readdirSync(dir).filter((f) => f.endsWith(".trace.json")).sort()) {
  const events = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const name = file.replace(/-\d+\.trace\.json$/, "");
  const s = frameStats(framesOf(events), markWindow(events), [...AMBIENT].some((a) => name.endsWith(a)) ? 1000 / 30 : null);
  console.log(`${name.padEnd(32)} ${String(s.fps).padStart(5)} i/s · p95 ${s.intervalP95} p99 ${s.intervalP99} max ${s.intervalMax} · abandonnées ${s.dropped}/${s.expected} (${(s.droppedRatio * 100).toFixed(1)} %) rafales ${s.dropBursts} pire ${s.longestDropRun}`);
}
