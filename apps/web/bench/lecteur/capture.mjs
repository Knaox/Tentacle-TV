#!/usr/bin/env node
/**
 * Capture le labo du lecteur au Chrome sans tête — la preuve du rendu de l'axe « lecteur ».
 *
 *   node bench/lecteur/capture.mjs [dossier de sortie] [filtre]      (depuis apps/web)
 *
 * Construit la page (`vite build`), la sert sur `lecteur.localhost`, puis joue chaque scène de
 * `scenes.mjs` : une adresse du labo, des gestes (clic sur un bouton par son nom accessible,
 * survol), une capture. Sombre et clair là où le thème joue, à 1440 et à 1024 px de large.
 * `CHROME_PATH` désigne le Chrome à lancer ; à défaut, le chrome-headless-shell de
 * `~/.cache/puppeteer`. Un filtre (sous-chaîne du nom de scène) n'en rejoue qu'une partie.
 */

import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { buildLab, CHROME_ARGS, chromePath, serveLab } from "./labServer.mjs";
import { SCENES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? join(HERE, "captures"));
const FILTER = process.argv[3] ?? "";
const WIDTHS = [[1440, 810], [1024, 640]];

buildLab();
const server = await serveLab();
const { base } = server;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: CHROME_ARGS });
const errors = [];
let count = 0;

for (const scene of SCENES) {
  if (FILTER && !scene.name.includes(FILTER)) continue;
  for (const theme of scene.themes ?? ["dark"]) {
    for (const [width, height] of scene.widths ?? WIDTHS) {
      const label = `${scene.name}-${theme === "dark" ? "sombre" : "clair"}-${width}`;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => errors.push(`${label} : ${e.message}`));
      page.on("console", (m) => { if (m.type() === "error" && !/404|Failed to load resource/.test(m.text())) errors.push(`${label} (console) : ${m.text()}`); });
      await page.goto(`${base}?theme=${theme}&${scene.query}`);
      await page.waitForSelector(scene.ready ?? "[data-lab-stage], [data-lab-page]");
      await page.evaluate(() => document.fonts.ready);
      try {
        for (const step of scene.steps ?? []) await step(page);
      } catch (e) {
        errors.push(`${label} (geste) : ${e.message.split("\n")[0]}`);
      }
      await page.waitForTimeout(scene.settle ?? 450);
      await page.screenshot({ path: join(OUT, `${label}.png`) });
      await page.close();
      count += 1;
    }
  }
}

await browser.close();
server.close();
console.log(`${count} captures dans ${OUT}`);
if (errors.length) {
  console.error(`Erreurs de page :\n${[...new Set(errors)].join("\n")}`);
  process.exit(1);
}
