#!/usr/bin/env node
// Le dernier relevé de chaque suite pour une ou plusieurs étiquettes, côte à côte :
//   node perf/table.mjs dev lot
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summarize, verdicts } from "./analyze.mjs";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../out/perf");
const labels = process.argv.slice(2);
const files = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
const latest = (label, suite) => {
  const f = files.filter((n) => n.startsWith(`${label}-${suite}-`)).pop();
  return f ? JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) : null;
};
const th = (t) => (t ? `${String(t.fps60).padStart(4)} i/s ${String(t.dropped).padStart(3)} perdues pire ${String(t.worstMs).padStart(3)} ms` : "—");
for (const suite of ["rafale-accueil", "rafale-grille", "maintenu", "pendant-apercu", "pas-bas", "latence", "lecteur", "memoire"]) {
  console.log(`\n## ${suite}`);
  for (const label of labels) {
    const r = latest(label, suite);
    if (!r) {
      console.log(`  [${label}] —`);
      continue;
    }
    console.log(`  [${label}] ${r.sha?.slice(0, 9) ?? ""} charge ${r.loadStart}→${r.loadEnd}`);
    // Recalculé depuis le relevé brut : une règle d'analyse corrigée vaut pour les anciens relevés.
    const s = summarize(suite, r.raw);
    // Les seuils du « Validé fluidité » (analyze.mjs) : seuls les rouges sont listés.
    const ref = suite === "memoire" && label !== labels[0] ? latest(labels[0], suite) : null;
    const red = verdicts(suite, s, ref ? summarize(suite, ref.raw) : null).filter((v) => !v.ok);
    console.log(`    verdict : ${red.length ? `${red.length} rouge(s) — ${red.map((v) => `${v.name} = ${v.value} (cible ${v.target})`).join(" ; ")}` : "vert"}`);
    if (Array.isArray(s)) {
      for (const x of s) {
        const lat = x.fondMs !== undefined ? ` fond ${x.fondSetMs ?? "∅"}/${x.fondMs ?? "∅"} ms · vidéo ${x.videoSetMs ?? "∅"}/${x.videoMs ?? "∅"} ms · ${x.jumps?.movements ?? "∅"} mouvement(s), immobile +${x.jumps?.settledAtMs ?? "∅"} ms · saut ${x.jumps ? `${x.jumps.maxStepPt}/${x.jumps.maxPt} pt${x.jumps.jumped ? ` (${x.jumps.key} à +${x.jumps.atMsAfterFocus} ms)` : ""}` : "∅"} ·` : "";
        const release = x.afterReleaseMs != null ? ` lâcher → focus ${x.afterReleaseMs} ms (${x.endFocus}) ·` : "";
        const rate = x.focusRate ? ` pas/s ${x.focusRate.min}-${x.focusRate.median}-${x.focusRate.max} (${x.focusRate.steps} pas) ·` : "";
        console.log(`    ${x.label.padEnd(44)}${lat}${release}${rate} UI ${th(x.ui)} | JS ${th(x.js)} | vues +${x.views.created}${x.views.video !== undefined ? ` (vidéo ${x.views.video})` : ""} −${x.views.removed}`);
      }
    } else if (suite === "lecteur") {
      console.log(`    vues vidéo créées ${s.videoViewsCreated} (${s.videoClasses.join(",")}), montées par pas ${s.mountedPerStep.join(" ")} · vues +${s.createdViews} −${s.removedViews} · UI ${th(s.ui)} | JS ${th(s.js)}`);
    } else if (suite === "memoire") {
      console.log(`    ${s.minutes} min, ${s.cycles} tours · RSS ${s.rssMb.start} → ${s.rssMb.end} Mo (max ${s.rssMb.max}) · tas JS ${s.heapMb.start} → ${s.heapMb.end} Mo · même processus ${s.pidStable}`);
    }
  }
}
