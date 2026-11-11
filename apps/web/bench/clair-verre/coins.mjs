#!/usr/bin/env node
/**
 * Banc « clair-verre » : les COINS du Liquid Glass (pont de la coquille simulé, mode `native`).
 *
 *   node bench/clair-verre/coins.mjs [filtre de scène…]      (depuis apps/web ; THEME=light|dark)
 *
 * Pour chaque écran et chaque calque ouvert, liste les formes de verre dont un calque, un descendant
 * ou la lentille ne suit pas le rayon. Code de sortie 1 s'il en reste.
 */
import { CORNERS } from "./lib/corners.mjs";
import { openSession, visit } from "./lib/session.mjs";
import { buildScenes } from "./scenes.mjs";

const filters = process.argv.slice(2);
const { browser, page } = await openSession({ theme: process.env.THEME === "dark" ? "dark" : "light", glass: true });
const scenes = (await buildScenes(page)).filter((s) => filters.length === 0 || filters.some((f) => s.name.includes(f)));
let total = 0;
for (const scene of scenes) {
  try {
    if (scene.route) await visit(page, scene.route, scene.settle);
    if (scene.steps) await scene.steps(page);
    const found = await page.evaluate(CORNERS);
    const unique = [...new Map(found.map((f) => [`${f.kind}|${f.who}|${f.corner ?? ""}`, f])).values()];
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
