#!/usr/bin/env node
/**
 * Capture le labo du hors ligne au Chrome sans tête — la preuve du rendu, en sombre et en clair,
 * à 1440 et à 1024 px.
 *
 *   node bench/hors-ligne/capture.mjs [dossier de sortie] [filtre]      (depuis apps/web)
 *
 * Construit la page (`vite build`), la sert sur `hors-ligne.localhost` avec le « disque » du labo
 * (`/disk/meta/<titre>/<fichier>` → `disk.json` → `img/`), puis prend chaque écran de l'axe dans
 * ses états. La file est avancée DANS la même page (début → un épisode fini → milieu) : le script
 * vérifie que le pourcentage du lot ne recule pas. `CHROME_PATH` désigne le Chrome à lancer ; à
 * défaut, le chrome-headless-shell de `~/.cache/puppeteer`. `filtre` : ne prendre que les captures
 * dont le nom le contient.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const OUT = resolve(process.argv[2] ?? join(HERE, "captures"));
const ONLY = process.argv[3] ?? "";
const DIST = join(tmpdir(), "tentacle-hors-ligne-lab");
const DISK = JSON.parse(readFileSync(join(HERE, "disk.json"), "utf8"));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp" };

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
  for (const version of existsSync(root) ? readdirSync(root).sort().reverse() : []) {
    for (const flavour of readdirSync(join(root, version))) {
      const binary = join(root, version, flavour, "chrome-headless-shell");
      if (existsSync(binary)) return binary;
    }
  }
  throw new Error("Aucun Chrome sans tête : poser CHROME_PATH.");
}

if (!process.env.SKIP_BUILD) {
  execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });
}

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  // Le « disque » : les visuels d'un titre gardé, tels que le serveur local du bureau les sert.
  const disk = /^\/disk\/meta\/([^/]+)\/([^/]+)$/.exec(pathname);
  const path = disk ? (DISK[disk[1]]?.[disk[2]] ? join(HERE, "img", DISK[disk[1]][disk[2]]) : "") : join(DIST, pathname.replace(/\/$/, "/index.html"));
  if (path === "" || !(path.startsWith(DIST) || path.startsWith(HERE)) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://hors-ligne.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP hors-ligne.localhost 127.0.0.1"] });
const errors = [];
const THEMES = [["dark", "sombre"], ["light", "clair"]];
const WIDTHS = [1440, 1024];

/** Une page du labo : `query` sans le thème ; `storage` : posé avant le démarrage. */
async function open(theme, width, query, storage = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => errors.push(`${query} (${theme}, ${width}) : ${e.message}`));
  await page.addInitScript((entries) => { for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value); }, storage);
  await page.goto(`${base}?theme=${theme}&${query}`);
  await page.waitForSelector("[data-lab-view]");
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return page;
}

/** Laisse les images locales arriver et les entrées se poser. */
async function settle(page, ms = 700) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

/** Parcourt la page jusqu'en bas puis revient : les images en chargement paresseux arrivent. */
async function reveal(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 500);
}

const wanted = (name) => ONLY === "" || name.includes(ONLY);
const fileOf = (name, label, width) => join(OUT, `${name}-${label}-${width}.png`);
const lotPercent = (page) => page.evaluate(() => Number(document.querySelector("[data-lot-percent]")?.getAttribute("data-lot-percent") ?? NaN));
const OFFLINE = { tentacle_offline_manual: "1" };

for (const [theme, label] of THEMES) {
  for (const width of WIDTHS) {
    const shot = async (name, query, { storage, act, fullPage = false } = {}) => {
      if (!wanted(name)) return;
      const page = await open(theme, width, query, storage);
      if (act) await act(page);
      if (fullPage) await reveal(page);
      await page.screenshot({ path: fileOf(name, label, width), fullPage });
      await page.close();
    };

    // ── La feuille « télécharger » ──
    await shot("feuille-film", "vue=feuille-film");
    await shot("feuille-film-allege", "vue=feuille-film", { act: async (page) => { await page.getByRole("button", { name: /Allégé/ }).click(); await page.waitForTimeout(300); } });
    await shot("feuille-film-espace-insuffisant", "vue=feuille-film&espace=refus", { act: async (page) => { await page.getByRole("button", { name: "Télécharger le film" }).click(); await page.waitForTimeout(400); } });
    await shot("feuille-episode", "vue=feuille-episode");
    await shot("feuille-saison", "vue=feuille-saison");
    await shot("feuille-serie", "vue=feuille-serie");
    await shot("suppression", "vue=suppression");

    // ── La file : un lot de 8 épisodes, avancé dans la MÊME page — le pourcentage ne recule pas ──
    if (wanted("file-lot")) {
      const page = await open(theme, width, "vue=file&etat=debut");
      const seen = [];
      for (const state of ["debut", "fini", "milieu"]) {
        if (state !== "debut") await page.evaluate((next) => window.__horsLigneLab.setQueue(next), state);
        await settle(page, 600);
        await reveal(page);
        seen.push(await lotPercent(page));
        await page.screenshot({ path: fileOf(`file-lot-${seen.length}-${state}`, label, width), fullPage: true });
        // Le bouton de la barre, agrandi trois fois : l'anneau fait 34 px.
        await page.locator("[data-lab-bar]").screenshot({ path: fileOf(`barre-${seen.length}-${state}`, label, width), scale: "css", style: "[data-lab-bar] { zoom: 3; }" });
      }
      if (!(seen[0] <= seen[1] && seen[1] <= seen[2]) || seen.some(Number.isNaN)) errors.push(`le pourcentage du lot a reculé (${theme}, ${width}) : ${seen.join(" → ")}`);
      else console.log(`lot (${label}, ${width}) : ${seen.join(" % → ")} %`);
      await page.close();
    }
    for (const state of ["pause", "erreur", "echec", "repos", "vide"]) {
      await shot(`file-${state}`, `vue=file&etat=${state}`, { fullPage: true });
    }
    await shot("file-selection", "vue=file&etat=repos", { fullPage: true, act: async (page) => {
      await page.getByRole("button", { name: "Sélectionner" }).click();
      await page.getByRole("checkbox").nth(0).click();
      await page.getByRole("checkbox").nth(1).click();
      await page.waitForTimeout(300);
    } });

    // ── « Sur cet appareil » ──
    await shot("catalogue-plein", "vue=catalogue", { fullPage: true });
    // Les grilles démontent leurs cellules hors champ : le bas de page a sa propre capture.
    await shot("catalogue-grilles", "vue=catalogue", { act: async (page) => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await settle(page, 900);
    } });
    await shot("catalogue-vide", "vue=catalogue&etat=vide", { fullPage: true });
    await shot("catalogue-hors-ligne", "vue=catalogue", { storage: OFFLINE });
    await shot("catalogue-hors-ligne-vide", "vue=catalogue&etat=vide", { storage: OFFLINE });
    await shot("serie-reprendre-episode-3", "vue=serie", { act: (page) => settle(page, 900) });
    await shot("serie-episodes", "vue=serie", { fullPage: true, act: (page) => settle(page, 900) });
    await shot("film-local", "vue=film", { fullPage: true, act: (page) => settle(page, 900) });

    // ── Le passage hors ligne et les boutons ──
    await shot("avis-passage-hors-ligne", "vue=avis&reseau=coupe", { act: async (page) => { await page.waitForSelector('[data-lab-ready="true"]'); await page.waitForTimeout(500); } });
    await shot("avis-pastille-ouverte", "vue=avis&reseau=coupe", { act: async (page) => {
      await page.waitForSelector('[data-lab-ready="true"]');
      await page.getByRole("button", { name: /Hors ligne/ }).first().click();
      await page.waitForTimeout(500);
    } });
    await shot("boutons", "vue=boutons");
  }
}

await browser.close();
server.close();
console.log(`${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT}`);
if (errors.length) {
  console.error(`Erreurs :\n${[...new Set(errors)].join("\n")}`);
  process.exit(1);
}
