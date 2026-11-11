#!/usr/bin/env node
/**
 * Banc « clair-verre » : le tour des écrans dans la VRAIE coquille CEF (macOS), par captures de sa fenêtre —
 * ce que l'utilisateur voit, verre natif et densité Retina compris. L'app est déjà lancée, en sourdine et sans
 * prendre le focus :
 *
 *   Tentacle --url=http://127.0.0.1:5413 --profile=<jetable> --user-data=<jetable> --mute --background --devtools-port=9413
 *   CEF_PID=<pid> node bench/clair-verre/cef-tour.mjs <dossier> [filtre de scène…]      (depuis apps/web)
 *
 * THEME=light|dark ; GLASS=0 coupe le réglage (le bureau sans verre). Une capture de la FENÊTRE par scène
 * (`screencapture -l`, jamais l'écran) et une de la page (CDP). ⚠️ La fenêtre est INACTIVE : le verre natif d'une
 * fenêtre active est plus clair (docs/LIQUID-GLASS.md, § 7) — ce banc ne juge pas le lecteur.
 */
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { connectCef, windowId, windowShot } from "./lib/cef.mjs";
import { buildScenes } from "./scenes.mjs";

const [outArg, ...filters] = process.argv.slice(2);
if (!outArg || !process.env.CEF_PID) throw new Error("usage : CEF_PID=<pid> cef-tour.mjs <dossier> [filtre…]");
const OUT = resolve(outArg);
mkdirSync(OUT, { recursive: true });
const theme = process.env.THEME === "light" ? "light" : "dark";
const { browser, page, origin } = await connectCef({ theme, glass: process.env.GLASS !== "0" });
const id = windowId(process.env.CEF_PID);
if (!id) throw new Error("fenêtre de l'app introuvable");
const scenes = (await buildScenes(page)).filter((s) => filters.length === 0 || filters.some((f) => s.name.includes(f)));

for (const scene of scenes) {
  try {
    if (scene.route) {
      await page.goto(`${origin}${scene.route}`, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(scene.settle ?? 2500);
      for (let i = 0; i < 3; i++) {
        const close = page.locator('[role="dialog"] button[aria-label="Fermer"]').first();
        if (!(await close.count())) break;
        await close.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(700);
      }
    }
    if (scene.steps) await scene.steps(page);
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => `${document.documentElement.dataset.theme} / ${document.documentElement.dataset.liquidGlass} / ×${devicePixelRatio}`);
    windowShot(id, join(OUT, `${scene.name}.png`));
    console.log(`• ${scene.name} — ${state}`);
    if (scene.after) await scene.after(page);
  } catch (error) {
    console.log(`! ${scene.name} — ${error.message.split("\n")[0]}`);
  }
}
await browser.close();
