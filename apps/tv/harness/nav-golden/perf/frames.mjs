#!/usr/bin/env node
// La position de la rangée IMAGE PAR IMAGE autour des pas d'une rafale (la tête
// de la famille suivie, `_measurePaper` à chaque image du fil UI), pour dire
// lequel des écrivains natifs bouge la rangée :
//   node perf/frames.mjs <étiquette> [motif du libellé, défaut « rafale DROITE ×6 »]
// Par pas : position et vitesse sur ±3 images autour du focus, reculs (> 0,5 pt
// vers l'arrière), et ARRÊTS en pleine course (une image immobile entre deux qui bougent).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../out/perf");
const [label, pattern = "rafale DROITE ×6"] = process.argv.slice(2);
const file = fs.readdirSync(dir).filter((n) => n.startsWith(`${label}-rangees-`)).sort().pop();
if (!file) throw new Error(`aucun relevé rangees pour ${label}`);
const { raw } = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
for (const d of raw.dwells.filter((x) => x.label.includes(pattern))) {
  const r = d.report;
  const pts = r.ui.trace.filter((row) => row[0] >= d.sentAt && row[1] != null).map((row) => [row[0] - d.sentAt, row[1]]);
  const v = pts.map((p, k) => (k ? Math.round((p[1] - pts[k - 1][1]) * 10) / 10 : 0));
  const back = pts.filter((p, k) => k && Math.sign(v[k]) > 0 && Math.abs(v[k]) > 0.5).map(([t]) => t);
  const stalls = pts.filter((p, k) => k > 1 && k < pts.length - 1 && Math.abs(v[k]) <= 0.5 && Math.abs(v[k - 1]) > 2 && Math.abs(v[k + 1]) > 2).map(([t]) => t);
  console.log(`\n${d.label} — ${pts.length} images, reculs ${back.length} [${back.join(", ")}], arrêts en course ${stalls.length} [${stalls.join(", ")}]`);
  for (const [tf] of r.focus.map((f) => [f[0] - d.sentAt])) {
    const k = pts.findIndex(([t]) => t >= tf);
    if (k < 0) continue;
    const win = pts.slice(Math.max(1, k - 3), k + 4).map(([t, x], j) => `${t}:${Math.round(x)}(${v[Math.max(1, k - 3) + j] > 0 ? "+" : ""}${v[Math.max(1, k - 3) + j]})`);
    console.log(`  focus +${tf} ms : ${win.join("  ")}`);
  }
}
