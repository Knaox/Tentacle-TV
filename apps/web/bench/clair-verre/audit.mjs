#!/usr/bin/env node
/**
 * Banc « clair-verre » : le CONTRASTE de chaque écran, mesuré au pixel sur une instance réelle.
 *
 *   node bench/clair-verre/audit.mjs <dossier de sortie> [filtre de scène…]      (depuis apps/web)
 *
 * Variables : THEME=light|dark (défaut light) ; GLASS=1 (pont de la coquille simulé, Liquid Glass
 * allumé : la part du verre peinte par la page) ; SHELL=1 (bureau sans verre) ; BANC_ORIGIN (défaut
 * http://127.0.0.1:5413) ; BANC_TOKENS (jetons d'appareil du compte de banc) ; SHOTS=0 (pas de capture).
 *
 * Sortie : `<dossier>/<scène>-<n>.png` (ce que l'œil voit), `<dossier>/rapport.json` (chaque défaut),
 * et un résumé par scène. Code de sortie 1 s'il reste un défaut.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { failures, measureViewport, summarize } from "./lib/contrast.mjs";
import { openSession, visit } from "./lib/session.mjs";
import { buildScenes } from "./scenes.mjs";

const [outArg, ...filters] = process.argv.slice(2);
if (!outArg) throw new Error("usage : audit.mjs <dossier de sortie> [filtre de scène…]");
const OUT = resolve(outArg);
mkdirSync(OUT, { recursive: true });
const theme = process.env.THEME === "dark" ? "dark" : "light";
const glass = process.env.GLASS === "1";
const shots = process.env.SHOTS !== "0";

const { browser, page, errors } = await openSession({ theme, glass, shell: glass || process.env.SHELL === "1" });
const scenes = (await buildScenes(page)).filter((s) => filters.length === 0 || filters.some((f) => s.name.includes(f)));

/** Fait défiler la page (ou son conteneur de défilement) d'un écran ; faux s'il n'y a plus rien dessous. */
const scrollDown = () => page.evaluate(() => {
  const candidates = [document.scrollingElement, ...document.querySelectorAll("main, [data-scroll-root], .overflow-y-auto")];
  for (const el of candidates) {
    if (!el || el.scrollHeight - el.clientHeight < 40) continue;
    const before = el.scrollTop;
    el.scrollTop = before + Math.round(innerHeight * 0.85);
    if (el.scrollTop > before + 4) return true;
  }
  return false;
});

const report = [];
let total = 0;
for (const scene of scenes) {
  try {
    if (scene.route) await visit(page, scene.route, scene.settle);
    if (scene.steps) await scene.steps(page);
    const sceneFails = [];
    let measured = 0;
    for (let screen = 0; screen < (scene.screens ?? 1); screen++) {
      if (shots) await page.screenshot({ path: join(OUT, `${scene.name}-${screen}.png`) });
      const results = await measureViewport(page, process.env.SHOTS === "2" ? join(OUT, `${scene.name}-${screen}-fond.png`) : null);
      measured += results.length;
      sceneFails.push(...failures(results).map((f) => ({ ...f, screen })));
      if (screen + 1 < (scene.screens ?? 1)) {
        if (!(await scrollDown())) break;
        await page.waitForTimeout(900);
      }
    }
    const groups = summarize(sceneFails);
    total += groups.length;
    report.push({ scene: scene.name, route: scene.route ?? null, measured, failing: sceneFails.length, groups });
    console.log(`${groups.length === 0 ? "✓" : "✗"} ${scene.name} — ${measured} relevés, ${sceneFails.length} en défaut (${groups.length} couples)`);
    for (const g of groups.slice(0, Number(process.env.TOP ?? 12))) {
      console.log(`    ${g.ratio.toFixed(2)}:1 < ${g.threshold}  ${g.kind} ${g.fg} sur ${g.bg} ×${g.count}  « ${g.samples.join(" | ")} »\n        ${g.path}`);
    }
    if (scene.after) await scene.after(page);
  } catch (error) {
    console.log(`! ${scene.name} — ${error.message.split("\n")[0]}`);
    report.push({ scene: scene.name, error: error.message });
  }
}

writeFileSync(join(OUT, "rapport.json"), JSON.stringify({ theme, glass, date: new Date().toISOString(), report }, null, 1));
if (errors.length) console.log(`Erreurs de page : ${[...new Set(errors)].slice(0, 8).join(" ; ")}`);
console.log(`${total} couples en défaut sur ${scenes.length} scènes — ${join(OUT, "rapport.json")}`);
await browser.close();
process.exit(total === 0 ? 0 : 1);
