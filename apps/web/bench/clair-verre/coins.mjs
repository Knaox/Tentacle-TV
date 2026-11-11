#!/usr/bin/env node
/**
 * Banc « clair-verre » : les COINS du Liquid Glass (pont de la coquille simulé, mode `native`).
 *
 *   node bench/clair-verre/coins.mjs [filtre de scène…]      (depuis apps/web ; THEME=light|dark)
 *
 * Pour chaque écran et chaque calque ouvert, liste les formes de verre dont un calque, un descendant
 * ou la lentille ne suit pas le rayon. Code de sortie 1 s'il en reste.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { CORNERS, SHAPES, squareCorners } from "./lib/corners.mjs";
import { decodePng } from "./lib/png.mjs";
import { openSession, visit } from "./lib/session.mjs";
import { buildScenes } from "./scenes.mjs";

const filters = process.argv.slice(2);
// ZOOMS=<dossier> : un gros plan de chaque angle suspect, pour le juger à l'œil.
const ZOOMS = process.env.ZOOMS ? resolve(process.env.ZOOMS) : null;
if (ZOOMS) mkdirSync(ZOOMS, { recursive: true });
// Densité 2 par défaut : celle d'un Mac Retina. À lancer avec BANC_NAVIGATEUR=complet (le « headless shell » ne
// givre pas toute une grande surface en densité 2 : un artefact, pas un défaut de l'app).
const DENSITY = Number(process.env.DPR ?? 2);
const { browser, page } = await openSession({ theme: process.env.THEME === "dark" ? "dark" : "light", glass: true, scale: DENSITY });
const scenes = (await buildScenes(page)).filter((s) => filters.length === 0 || filters.some((f) => s.name.includes(f)));
let total = 0;
for (const scene of scenes) {
  try {
    if (scene.route) await visit(page, scene.route, scene.settle);
    if (scene.steps) await scene.steps(page);
    const found = await page.evaluate(CORNERS);
    // Au pixel : l'angle d'une forme arrondie laisse voir le dessous.
    const shapes = await page.evaluate(SHAPES);
    const image = decodePng(await page.screenshot({ type: "png" }));
    let zoom = 0;
    for (const shape of shapes) {
      for (const square of squareCorners(shape, image, DENSITY)) {
        found.push({ kind: "pixel", who: shape.who, corner: square.corner, own: shape.radii, got: square.why, rect: shape.rect.map(Math.round) });
        if (ZOOMS && zoom < 12) {
          const [x, y, w, h] = shape.rect;
          const cx = square.corner.includes("droit") ? x + w : x;
          const cy = square.corner.includes("bas") ? y + h : y;
          await page.screenshot({ path: join(ZOOMS, `${scene.name}-${zoom++}.png`), clip: { x: Math.max(0, cx - 40), y: Math.max(0, cy - 40), width: 80, height: 80 } });
        }
      }
    }
    const unique = [...new Map(found.map((f) => [`${f.kind}|${f.who}|${f.corner ?? ""}`, f])).values()];
    console.log(`  (${shapes.length} formes de verre regardées)`);
    total += unique.length;
    console.log(`${unique.length === 0 ? "✓" : "✗"} ${scene.name} — ${unique.length} coin(s) en défaut`);
    for (const f of unique) console.log(`    ${f.kind} ${f.corner ?? ""} rayon ${JSON.stringify(f.own)} ≠ ${JSON.stringify(f.got)}${f.gap !== undefined ? ` (écart ${f.gap})` : ""} @${f.rect.join(",")}\n        ${f.who}`);
    if (scene.after) await scene.after(page);
  } catch (error) {
    console.log(`! ${scene.name} — ${error.message.split("\n")[0]}`);
  }
}
console.log(`${total} coin(s) en défaut sur ${scenes.length} scènes`);
await browser.close();
process.exit(total === 0 ? 0 : 1);
