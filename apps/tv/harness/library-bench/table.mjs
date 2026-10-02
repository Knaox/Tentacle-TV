// Le tableau des médianes de `measure.mjs ab` : node table.mjs <version> <version>…
// (lit out/<version>-{open,hold,steps}<n>.result.json).
import fs from "node:fs";
import path from "node:path";
import { OUT } from "./lib/device.mjs";

const median = (values) => {
  const xs = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return "—";
  const mid = Math.floor(xs.length / 2);
  return Math.round(10 * (xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2)) / 10;
};
const results = (version, kind) =>
  fs.readdirSync(OUT)
    .filter((f) => new RegExp(`^${version}-${kind}\\d+\\.result\\.json$`).test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")));

const ROWS = [
  ["Ouverture : 1re affiche (ms)", "open", (r) => r.firstPosterMs],
  ["Ouverture : premier écran complet (ms)", "open", (r) => r.screenCompleteMs],
  ["Ouverture : pire tâche JS (ms)", "open", (r) => r.js?.worst?.[0]],
  ["BAS maintenu 8 s : lignes parcourues", "hold", (r) => r.rowsMoved],
  ["BAS maintenu : affiches vides (% du temps)", "hold", (r) => r.blankRatio],
  ["BAS maintenu : pire attente d'une affiche (ms)", "hold", (r) => r.worstBlankMs],
  ["BAS maintenu : affiches là après l'arrêt (ms)", "hold", (r) => r.settleAfterStopMs],
  ["BAS maintenu : fil d'interface (i/s)", "hold", (r) => r.ui?.fps60],
  ["BAS maintenu : fil JS (i/s)", "hold", (r) => r.js?.fps60],
  ["BAS maintenu : pire tâche JS (ms)", "hold", (r) => r.js?.worst?.[0]],
  ["BAS maintenu : RAM en fin (Mo)", "hold", (r) => r.ram?.endMB],
  ["30 pas : fil d'interface (i/s)", "steps", (r) => r.ui?.fps60],
  ["30 pas : fil JS (i/s)", "steps", (r) => r.js?.fps60],
  ["30 pas : CPU de l'app par ligne (ms)", "steps", (r) => (r.rowsMoved ? r.cpuAppMs / r.rowsMoved : undefined)],
  ["30 pas : GPU du simulateur (ms/s)", "steps", (r) => r.gpu?.gpuMsPerS],
];

const versions = process.argv.slice(2);
console.log(`| Mesure | ${versions.join(" | ")} |`);
console.log(`|---|${versions.map(() => "---").join("|")}|`);
for (const [title, kind, pick] of ROWS) {
  console.log(`| ${title} | ${versions.map((v) => median(results(v, kind).map(pick))).join(" | ")} |`);
}
