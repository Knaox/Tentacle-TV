#!/usr/bin/env node
/**
 * Capture le labo des fiches au Chrome sans tête — la preuve du rendu des VRAIS écrans de
 * l'axe (bibliothèque et filtres, fiche, personne, recherche, Ma liste, Mes favoris), en
 * sombre et en clair, à 1440 et à 1024 px.
 *
 *   node bench/fiches/capture.mjs [dossier de sortie] [filtre de nom]      (depuis apps/web)
 *
 * Construit la page (`vite build`, sauf `SKIP_BUILD=1`), la sert sur `fiches.localhost`, puis
 * joue chaque scène : l'écran au repos (page entière), ses états, ses menus OUVERTS. Les
 * chemins que le serveur factice ne connaît pas sont listés à la fin. `CHROME_PATH` désigne le
 * Chrome à lancer ; à défaut, le chrome-headless-shell de `~/.cache/puppeteer`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { SCENES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const OUT = resolve(process.argv[2] ?? join(HERE, "captures"));
const ONLY = process.argv[3] ?? "";
const DIST = join(tmpdir(), "tentacle-fiches-lab");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp" };
const WIDTHS = [[1440, 900], [1024, 768]];

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
  const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://fiches.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP fiches.localhost 127.0.0.1"] });
const errors = [];
const misses = new Set();

/** Toutes les images à l'écran décodées, les fondus finis — après un aller-retour au bas de la
 *  page : les affiches d'une grille ne se chargent qu'à l'approche. */
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 120));
    }
    scrollTo(0, 0);
  });
  await page.waitForFunction(() => [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight * 3).every((img) => img.complete), null, { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(700);
}

async function open(theme, [width, height], scene) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: scene.motion ? "no-preference" : "reduce" });
  const tag = `${scene.name}/${theme}/${width}`;
  page.on("pageerror", (e) => errors.push(`${tag} : ${e.message}`));
  page.on("console", (message) => {
    const text = message.text();
    if (text.startsWith("[labo fiches]")) misses.add(text);
    else if (message.type() === "error" && !/Failed to load resource|__lab\/missing/.test(text)) errors.push(`${tag} : console — ${text.slice(0, 300)}`);
  });
  await page.goto(`${base}?theme=${theme}&route=${encodeURIComponent(scene.route)}`);
  await page.waitForSelector(scene.ready ?? "h1, [role=status], h2", { timeout: 15000 }).catch(() => errors.push(`${tag} : rien de rendu`));
  await settle(page);
  return page;
}

const scenes = SCENES.filter((scene) => scene.name.includes(ONLY));
for (const theme of ["dark", "light"]) {
  const mode = theme === "dark" ? "sombre" : "clair";
  for (const size of WIDTHS) {
    for (const scene of scenes) {
      const page = await open(theme, size, scene);
      try {
        if (scene.act) {
          await scene.act(page);
          await page.waitForTimeout(450);
        }
        await page.screenshot({ path: join(OUT, `${scene.name}-${mode}-${size[0]}.png`), fullPage: scene.full !== false && !scene.act });
        // Une rangée ou une ligne hors écran n'est pas montée (« ce qui n'est pas affiché ne
        // consomme rien ») : la suite d'une page longue se capture écran par écran.
        for (let screen = 2; screen <= (scene.screens ?? 1); screen += 1) {
          await page.evaluate((y) => scrollTo(0, y), (screen - 1) * size[1] * 0.9);
          await page.waitForTimeout(900);
          await page.screenshot({ path: join(OUT, `${scene.name}-${mode}-${size[0]}-ecran${screen}.png`) });
        }
      } catch (error) {
        errors.push(`${scene.name}/${theme}/${size[0]} : ${error.message.split("\n")[0]}`);
      }
      await page.close();
    }
  }
}

await browser.close();
server.close();
console.log(`${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT}`);
if (misses.size) console.log(`Chemins sans réponse du serveur factice :\n${[...misses].join("\n")}`);
if (errors.length) {
  console.error(`Erreurs de page :\n${[...new Set(errors)].join("\n")}`);
  process.exit(1);
}
