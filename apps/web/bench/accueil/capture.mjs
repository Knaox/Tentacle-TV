#!/usr/bin/env node
/**
 * Capture l'accueil au Chrome sans tête — la preuve du rendu, en sombre et en clair, à 1440 et
 * à 1024 px : la vraie coquille, la vraie page d'accueil et le labo `/dev/accueil`, sur le
 * serveur factice du banc (`labServer.ts`). Images, Chrome et construction : `serve.mjs`.
 *
 *   node bench/accueil/capture.mjs [dossier de sortie] [filtre]      (depuis apps/web)
 *
 * `filtre` : ne prend que les vues dont le nom le contient (« barre », « carte »…).
 */

import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startBench } from "./serve.mjs";
import { SHOTS } from "./shots.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.argv[2] ?? join(HERE, "captures"));
const FILTER = process.argv[3] ?? "";

const { base, browser, close } = await startBench();

mkdirSync(OUT, { recursive: true });
const errors = [];
const unhandled = new Set();

async function open({ theme, width, route = "/", libs = 3, etat = "ok", height = 900 }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`${route} (${theme}, ${width}) : ${e.message}`));
  if (process.env.ACCUEIL_CONSOLE) page.on("console", (m) => console.log(`[page:${m.type()}] ${m.text().slice(0, 400)}`));
  const query = new URLSearchParams({ theme, route, libs: String(libs), etat });
  await page.goto(`${base}?${query}`);
  await page.waitForSelector("[data-top-nav]", { timeout: 15_000 }).catch(async (error) => {
    console.error(`La coquille n'est pas montée (${route}) :\n${errors.join("\n")}\n${(await page.evaluate(() => document.body.innerText)).slice(0, 700)}`);
    throw error;
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  return page;
}

for (const shot of SHOTS.filter((s) => s.name.includes(FILTER))) {
  for (const theme of shot.themes ?? ["dark", "light"]) {
    for (const width of shot.widths ?? [1440, 1024]) {
      const page = await open({ theme, width, ...shot.open });
      const file = (suffix = "") => join(OUT, `accueil-${shot.name}${suffix}-${theme === "dark" ? "sombre" : "clair"}-${width}.png`);
      try {
        await shot.run(page, { file, width });
      } catch (error) {
        errors.push(`${shot.name} (${theme}, ${width}) : ${error.message.split("\n")[0]}`);
        await page.screenshot({ path: file("-ECHEC") });
      }
      for (const line of await page.evaluate(() => window.__labUnhandled ?? [])) unhandled.add(line);
      await page.close();
    }
  }
}

await close();
writeFileSync(join(OUT, "routes-sans-reponse.txt"), [...unhandled].sort().join("\n") + "\n");
console.log(`${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT} ; ${unhandled.size} adresse(s) sans réponse du serveur factice.`);
if (errors.length) {
  console.error(`Erreurs :\n${errors.join("\n")}`);
  process.exit(1);
}
