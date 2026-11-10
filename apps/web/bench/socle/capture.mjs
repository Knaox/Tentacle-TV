#!/usr/bin/env node
/**
 * Capture le labo du socle au Chrome sans tête — la preuve du rendu, en sombre et en clair.
 *
 *   node bench/socle/capture.mjs [dossier de sortie]      (depuis apps/web)
 *
 * Construit la page (`vite build`), la sert sur `socle.localhost`, puis prend : la page
 * entière et chaque vue dans les deux thèmes, le menu et la feuille OUVERTS, et l'état pressé
 * d'un bouton. `CHROME_PATH` désigne le Chrome à lancer ; à défaut, le chrome-headless-shell
 * de `~/.cache/puppeteer`.
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
const DIST = join(tmpdir(), "tentacle-socle-lab");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml" };

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

execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });

const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://socle.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP socle.localhost 127.0.0.1"] });
const errors = [];

async function open(theme, view) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.5 });
  page.on("pageerror", (e) => errors.push(`${theme}/${view ?? "tout"} : ${e.message}`));
  await page.goto(`${base}?theme=${theme}${view ? `&vue=${view}` : ""}`);
  await page.waitForSelector("h1");
  await page.evaluate(() => document.fonts.ready);
  return page;
}

for (const theme of ["dark", "light"]) {
  const name = theme === "dark" ? "sombre" : "clair";
  for (const view of [null, "jetons", "boutons", "controles", "calques"]) {
    const page = await open(theme, view);
    await page.screenshot({ path: join(OUT, `socle-${name}-${view ?? "tout"}.png`), fullPage: true });
    await page.close();
  }

  // Le menu OUVERT (il sort de son bouton), puis la feuille, puis un bouton pressé.
  const page = await open(theme, "calques");
  await page.getByRole("button", { name: "Plus d'actions" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `socle-${name}-menu-ouvert.png`) });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Ouvrir une feuille" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `socle-${name}-feuille-ouverte.png`) });
  await page.close();
}

await browser.close();
server.close();
console.log(`${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT}`);
if (errors.length) {
  console.error(`Erreurs de page :\n${errors.join("\n")}`);
  process.exit(1);
}
