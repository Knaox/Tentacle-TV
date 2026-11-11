#!/usr/bin/env node
/**
 * Banc « clair-verre » : ON NE PERD RIEN. L'inventaire des contrôles de chaque écran — boutons, liens, champs,
 * rangées de menu, onglets, interrupteurs —, relevé sur une instance, puis comparé à un autre relevé.
 *
 *   node bench/clair-verre/inventaire.mjs <sortie.json> [filtre de scène…]            (relever)
 *   node bench/clair-verre/inventaire.mjs --compare <avant.json> <après.json>         (comparer)
 *
 * BANC_ORIGIN choisit l'instance (le code de la base, puis la branche). Un contrôle se reconnaît à son rôle et
 * à son libellé (texte ou `aria-label`). Ce qui vient du CONTENU — une affiche, une vignette, une rangée de
 * titres, tirés au hasard ou différents d'un chargement à l'autre — n'est pas compté : seules les zones de
 * STRUCTURE le sont (barre du haut, barre d'outils et ses menus, rail et rubriques des réglages, calques).
 * Code de sortie 1 si un contrôle d'avant manque après.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { openSession, visit } from "./lib/session.mjs";
import { buildScenes } from "./scenes.mjs";

const args = process.argv.slice(2);

if (args[0] === "--compare") {
  const before = JSON.parse(readFileSync(args[1], "utf8"));
  const after = JSON.parse(readFileSync(args[2], "utf8"));
  let lost = 0;
  let scenes = 0;
  let controls = 0;
  for (const [scene, list] of Object.entries(before)) {
    if (!after[scene]) { console.log(`? ${scene} — absente du second relevé`); continue; }
    scenes++;
    controls += list.length;
    const remaining = [...after[scene]];
    const missing = [];
    for (const control of list) {
      const at = remaining.indexOf(control);
      if (at === -1) missing.push(control);
      else remaining.splice(at, 1);
    }
    lost += missing.length;
    console.log(`${missing.length === 0 ? "✓" : "✗"} ${scene} — ${list.length} contrôles avant, ${after[scene].length} après${missing.length ? ` ; ${missing.length} manquant(s)` : ""}${remaining.length ? ` ; ${remaining.length} en plus` : ""}`);
    for (const m of missing.slice(0, 12)) console.log(`    manque : ${m}`);
    for (const m of remaining.slice(0, 6)) console.log(`    en plus : ${m}`);
  }
  console.log(`${controls} contrôles sur ${scenes} écrans ; ${lost} manquant(s)`);
  process.exit(lost === 0 ? 0 : 1);
}

/** Dans la page : les contrôles des zones de structure, « rôle | libellé ». */
const COLLECT = () => {
  const zones = [
    ".lgc-capsule", "header", "nav", "section[aria-label]:has(input)", "section.ui-panel", ".ui-menu", '[role="menu"]', '[role="listbox"]',
    '[role="dialog"]', "aside", "[data-setting]", "main section header", "form",
  ];
  const skip = "[data-card-rating], .media-tile, [class*='group/card'], [class*='render-row'], [data-banc-ignore]";
  const seen = new Set();
  const out = [];
  for (const zone of document.querySelectorAll(zones.join(", "))) {
    for (const el of zone.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role^="menuitem"], [role="option"]')) {
      if (seen.has(el) || el.closest(skip) || !el.checkVisibility?.({ checkVisibilityCSS: true })) continue;
      seen.add(el);
      const role = el.getAttribute("role") ?? (el.tagName === "A" ? "link" : el.tagName === "INPUT" ? `input:${el.type}` : el.tagName.toLowerCase());
      const label = (el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
      // Un nombre qui change d'un chargement à l'autre (un compte, une heure) ne fait pas un autre contrôle.
      out.push(`${role} | ${label.replace(/\d+/g, "#")}`);
    }
  }
  return out.sort();
};

const [out, ...filters] = args;
if (!out) throw new Error("usage : inventaire.mjs <sortie.json> [filtre…] | --compare <avant> <après>");
const { browser, page } = await openSession({ theme: process.env.THEME === "dark" ? "dark" : "light", glass: process.env.GLASS === "1" });
const scenes = (await buildScenes(page)).filter((s) => !s.name.startsWith("labo-") && (filters.length === 0 || filters.some((f) => s.name.includes(f))));
const inventory = {};
for (const scene of scenes) {
  try {
    if (scene.route) await visit(page, scene.route, scene.settle);
    if (scene.steps) await scene.steps(page);
    await page.waitForTimeout(500);
    inventory[scene.name] = await page.evaluate(COLLECT);
    console.log(`• ${scene.name} — ${inventory[scene.name].length} contrôles`);
    if (scene.after) await scene.after(page);
  } catch (error) {
    console.log(`! ${scene.name} — ${error.message.split("\n")[0]}`);
  }
}
writeFileSync(out, JSON.stringify(inventory, null, 1));
await browser.close();
