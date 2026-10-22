#!/usr/bin/env node
// Banc de fluidité (lot lg5) : QUI coûte ? Le même geste, mesuré en retirant
// un effet du verre à la fois par une feuille injectée dans la page de l'Electron
// du banc (rien n'est changé au code) : lentille SVG, givre, couche du bord de
// défilement, ombres des glyphes… Verdict par étape du pipeline d'image :
// fil principal, rastérisation, DESSIN du processus GPU (`StartDrawToSwapStart`).
//
//   (mêmes variables que run.mjs) node perf/ablate.mjs [--scenario repos-accueil] [--rounds 2]
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connectAndLogin, dismissOverlays, sleep } from "../lib/app.mjs";
import { SERVER, STATE, account, outDir } from "../lib/config.mjs";
import { evalMain, launchApp, stopApp } from "../lib/electron.mjs";
import { frameStats, framesOf, markWindow, startTrace, stopTrace } from "./frames.mjs";
import { stageStats } from "./stages.mjs";
import { SCENARIOS } from "./scenarios.mjs";
import { ABLATIONS } from "./ablations.mjs";

const LOCKS = "/Users/damienrouge/Desktop/Projet - local/.claude/locks/lg";
const argv = process.argv.slice(2);
const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const scenarioNames = opt("--scenario", "repos-accueil,menus").split(",");
const rounds = Number(opt("--rounds", 2));
const which = opt("--only", null)?.split(",") ?? null;
const out = outDir("lg5-ablation");

while (readdirSync(LOCKS).some((n) => n.startsWith("electron-slot-"))) await sleep(10_000);
const app = await launchApp({ home: path.join(STATE, "home-lg5-ablation"), fresh: true, log: path.join(out, "electron.log") });
const results = [];
try {
  await connectAndLogin(app.page, { server: SERVER, ...account("Knaoxtest") });
  await sleep(5000);
  await dismissOverlays(app.page);
  // Écran verrouillé, fenêtre couverte : la page reste « visible » et peint (banc seulement).
  await evalMain(app, `require("electron").BrowserWindow.getAllWindows().forEach((w) => w.webContents.setBackgroundThrottling(false)); return 1;`);
  const ablations = ABLATIONS.filter((a) => which === null || which.includes(a.name));
  // Inventaire des lentilles de l'accueil : combien, et quelle surface.
  console.log(JSON.stringify(await app.page.evaluate(`return [...document.querySelectorAll("[style*='--lg-lens'], [style*='--lgc-lens']")].map((n) => { const r = n.getBoundingClientRect(); return (n.getAttribute("aria-label") || String(n.className).slice(0, 30)) + " " + Math.round(r.width) + "x" + Math.round(r.height); });`)));
  let dirty = false;
  for (let round = 0; round < rounds; round += 1) {
    for (const name of scenarioNames) {
      const scenario = SCENARIOS.find((s) => s.name === name);
      for (const ablation of ablations) {
        // Une variante de filtre MODIFIE le DOM : on recharge avant et après elle.
        if (dirty || ablation.js) {
          await app.page.evaluate(`history.replaceState({}, "", "/"); location.reload(); return 1;`).catch(() => {});
          await sleep(6000);
          await app.page.send("Runtime.enable");
          await dismissOverlays(app.page);
          dirty = false;
        }
        await app.page.evaluate(`document.getElementById("lg5-ablation")?.remove();
          const s = document.createElement("style"); s.id = "lg5-ablation"; s.textContent = ${JSON.stringify(ablation.css)};
          document.head.append(s);
          window.__lg5Mo?.disconnect(); document.querySelectorAll("filter[data-lg5]").forEach((f) => delete f.dataset.lg5);
          return 1;`);
        // Une variante de filtre : les filtres déjà modifiés restent modifiés jusqu'au rechargement.
        if (ablation.js) {
          await app.page.evaluate(`${ablation.js} return 1;`);
          dirty = true;
        }
        await scenario.prep(app.page);
        await sleep(600);
        await startTrace(app.page);
        await app.page.evaluate(`performance.mark("lg5:start"); return 1;`);
        await scenario.run(app.page).catch(() => {});
        await app.page.evaluate(`performance.mark("lg5:end"); return 1;`);
        const events = await stopTrace(app.page);
        if (argv.includes("--dump")) writeFileSync(path.join(out, `${name}-${ablation.name}-${round}.trace.json`), JSON.stringify(events));
        const window = markWindow(events);
        const f = frameStats(framesOf(events), window, scenario.cadenceMs ?? null);
        const st = stageStats(events, window);
        const r = { round, scenario: name, ablation: ablation.name, frames: f.frames, dropped: f.dropped, expected: f.expected, longest: f.longestDropRun, ...st };
        results.push(r);
        const fmt = (k) => `${st[k]?.p50 ?? "-"}/${st[k]?.p95 ?? "-"}`;
        console.log(`${name.padEnd(14)} ${ablation.name.padEnd(18)} images ${String(f.frames).padStart(4)} · abandonnées ${f.dropped}/${f.expected} pire ${f.longestDropRun} · dessin GPU ${fmt("StartDrawToSwapStart")} · fil principal ${fmt("SendBeginMainFrameToCommit")} · raster ${fmt("EndCommitToActivation")} ms (p50/p95)`);
        writeFileSync(path.join(out, "ablation.json"), `${JSON.stringify(results, null, 2)}\n`);
      }
    }
  }
} finally {
  await stopApp(app);
}
