#!/usr/bin/env node
/**
 * Capture le labo d'Octave au Chrome sans tête — la preuve du rendu des VRAIS écrans d'Octave sur
 * de fausses données, en sombre et en clair, à 1440 × 900 et à 1024 × 768.
 *
 *   node bench/octave/capture.mjs [dossier de sortie]      (depuis apps/web ; à défaut : `captures-octave/` à la racine du dépôt)
 *
 * Construit la page (`vite build`), la sert sur `octave.localhost` avec ses images (`img/`), puis
 * prend chaque scène (`scenes.mjs`) : la fenêtre visible seulement (la coquille est `fixed`). Les
 * calques s'ouvrent par un clic sur le vrai bouton. Fichiers : `octave-<sombre|clair>-<largeur>-<scène>.png`.
 *
 * Sort en code 1 s'il reste une erreur de page, une erreur de console, une requête `/api/` partie
 * vers le réseau, ou une scène manquée. `CHROME_PATH` désigne le Chrome à lancer ; à défaut, le
 * chrome-headless-shell de `~/.cache/puppeteer`. Pour n'en rejouer qu'une partie :
 * `OCTAVE_SCENES=album,file OCTAVE_THEMES=dark OCTAVE_SIZES=1440 node bench/octave/capture.mjs`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { HOVER_SCENE, SCENES } from "./scenes.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const OUT = resolve(process.argv[2] ?? resolve(WEB, "../../captures-octave"));
const DIST = join(tmpdir(), "tentacle-octave-lab");
const IMAGES = join(HERE, "img");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png" };
const SIZES = [{ width: 1440, height: 900 }, { width: 1024, height: 768 }];
const THEMES = [{ id: "dark", name: "sombre" }, { id: "light", name: "clair" }];
/** Le « maintenant » des captures : un mardi matin. */
const FIXED_NOW = new Date("2026-11-10T10:30:00+01:00");
/** Pages ouvertes en même temps. */
const PARALLEL = 4;

/** Les erreurs de console CONNUES, qui ne sont pas des défauts d'écran (aucune pour l'instant). */
const KNOWN_CONSOLE_ERRORS = [];

const only = (name) => (process.env[name] ? process.env[name].split(",").map((part) => part.trim()) : null);
const wantedScenes = only("OCTAVE_SCENES");
const wantedThemes = only("OCTAVE_THEMES");
const wantedSizes = only("OCTAVE_SIZES");

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

const started = Date.now();
execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  // Les images du banc vivent à côté de la page, jamais dans `public/`.
  const [root, rest] = pathname.startsWith("/img/") ? [IMAGES, pathname.slice(4)] : [DIST, pathname.replace(/\/$/, "/index.html")];
  const path = join(root, rest);
  if (!path.startsWith(root) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://octave.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP octave.localhost 127.0.0.1"] });
const errors = [];
const misses = new Set();

/** Polices prêtes, images VISIBLES chargées (ou en erreur : le repli dessiné), fondus finis. */
async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(() => {
      const visible = (img) => {
        const box = img.getBoundingClientRect();
        return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
      };
      return [...document.images].filter(visible).every((img) => img.complete);
    }, null, { timeout: 8000 })
    .catch(() => undefined);
  await page.waitForTimeout(450);
}

async function capture(scene, theme, size, file = scene.name) {
  const tag = `${theme.name}/${size.width}/${file}`;
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: "fr-FR", timezoneId: "Europe/Paris" });
  const page = await context.newPage();
  // Une heure FIXE (les minuteurs tournent) : le mot d'accueil et les jaquettes du jour ne changent pas d'un passage à l'autre.
  await page.clock.setFixedTime(FIXED_NOW);
  page.on("pageerror", (error) => errors.push(`${tag} : ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!KNOWN_CONSOLE_ERRORS.some((known) => known.test(text))) errors.push(`${tag} : console — ${text}`);
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) errors.push(`${tag} : requête partie — ${request.method()} ${request.url()}`);
  });
  try {
    await page.goto(`${base}?vue=${scene.view ?? scene.name}&theme=${theme.id}`);
    await page.waitForSelector("[data-octave-shell]", { timeout: 15000 });
    await settle(page);
    if (scene.act) {
      await scene.act(page);
      // Le calque s'ouvre (fondu, mise en place), puis ses images arrivent.
      await page.waitForTimeout(500);
      await settle(page);
    }
    await page.screenshot({ path: join(OUT, `octave-${theme.name}-${size.width}-${file}.png`) });
    for (const miss of await page.evaluate(() => window.__octaveLab?.misses ?? [])) misses.add(miss);
  } catch (error) {
    errors.push(`${tag} : scène manquée — ${String(error.message ?? error).split("\n")[0]}`);
    await page.screenshot({ path: join(OUT, `octave-${theme.name}-${size.width}-${file}-ECHEC.png`) }).catch(() => undefined);
  }
  await context.close();
}

const jobs = [];
for (const size of SIZES.filter((s) => !wantedSizes || wantedSizes.includes(String(s.width)))) {
  for (const theme of THEMES.filter((t) => !wantedThemes || wantedThemes.includes(t.id))) {
    for (const scene of SCENES.filter((s) => !wantedScenes || wantedScenes.includes(s.name))) jobs.push(() => capture(scene, theme, size));
  }
}
// Le survol d'une carte d'album de l'accueil : la pochette grandit, le bouton lecture paraît.
if (!wantedScenes || wantedScenes.includes(HOVER_SCENE.name)) jobs.push(() => capture(HOVER_SCENE, THEMES[0], SIZES[0]));

const total = jobs.length;
await Promise.all(Array.from({ length: PARALLEL }, async () => {
  for (let job = jobs.shift(); job; job = jobs.shift()) await job();
}));

await browser.close();
server.close();
console.log(`${total} scènes jouées, ${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT} (${Math.round((Date.now() - started) / 1000)} s)`);
if (misses.size) console.log(`Routes que le faux serveur ne connaît pas (404 immédiat, sans réseau) :\n  ${[...misses].sort().join("\n  ")}`);
if (errors.length) {
  console.error(`Erreurs :\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
