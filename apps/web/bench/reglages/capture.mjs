#!/usr/bin/env node
/**
 * Capture le labo des réglages et de l'administration au Chrome sans tête — la preuve du rendu,
 * en sombre et en clair, à 1440 et à 1024 px.
 *
 *   node bench/reglages/capture.mjs [dossier de sortie] [options]      (depuis apps/web)
 *
 *   --only=lecture,admin     ne prend que ces plans (préfixes de leur nom)
 *   --theme=dark|light       un seul thème          --width=1440|1024   une seule largeur
 *   --no-build               reprend la page déjà construite
 *
 * Construit la page (`vite build`), la sert sur `reglages.localhost`, puis prend chaque plan de
 * `shots.mjs` : un écran du labo (`?vue=`), éventuellement après un geste (ouvrir « Avancé »,
 * taper dans la recherche). Les requêtes restées SANS donnée factice sont listées par plan : un
 * écran n'est jamais capturé sur une requête muette sans qu'on le sache. `CHROME_PATH` désigne
 * le Chrome à lancer ; à défaut, le chrome-headless-shell de `~/.cache/puppeteer`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { SHOTS } from "./shots.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const OUT = resolve(args.find((a) => !a.startsWith("--")) ?? join(HERE, "captures"));
// `LAB_TAG` : deux bancs lancés en même temps ne construisent pas au même endroit.
const DIST = join(tmpdir(), `tentacle-reglages-lab-${process.env.LAB_TAG ?? "main"}`);
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml",
  ".webp": "image/webp", ".png": "image/png", ".json": "application/json",
};

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

if (!args.includes("--no-build")) {
  execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });
}

const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://reglages.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP reglages.localhost 127.0.0.1"] });
const errors = [];
const misses = new Map();

const only = flag("only")?.split(",");
const themes = flag("theme") ? [flag("theme")] : ["dark", "light"];
const widths = flag("width") ? [Number(flag("width"))] : [1440, 1024];
const shots = SHOTS.filter((shot) => !only || only.some((prefix) => shot.name.startsWith(prefix)));

for (const theme of themes) {
  for (const width of widths) {
    for (const shot of shots) {
      const tag = `${shot.name}-${theme === "dark" ? "sombre" : "clair"}-${width}`;
      const page = await browser.newPage({ viewport: { width, height: shot.height ?? 900 }, deviceScaleFactor: 1 });
      page.on("pageerror", (e) => errors.push(`${tag} : ${e.message}`));
      const query = new URLSearchParams({ theme, vue: shot.vue, lang: "fr", ...(shot.params ?? {}) });
      await page.goto(`${base}?${query}`);
      await page.evaluate(() => document.fonts.ready);
      try {
        await page.waitForSelector(shot.ready ?? "h1", { timeout: 8000 });
        await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => undefined);
        await page.waitForTimeout(shot.settle ?? 500);
        if (shot.act) await shot.act(page);
      } catch (e) {
        errors.push(`${tag} : ${e.message.split("\n")[0]}`);
      }
      // `clip` : une partie de l'écran seulement (un aperçu, une ligne), cadrée sur son élément.
      const part = shot.clip ? page.locator(shot.clip).first() : null;
      if (part && (await part.count()) > 0) {
        await part.screenshot({ path: join(OUT, `${tag}.png`) });
      } else {
        // Revenu en haut : une page amenée sur une ancre photographierait son rail collant au milieu.
        if (shot.fullPage !== false) await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(120);
        await page.screenshot({ path: join(OUT, `${tag}.png`), fullPage: shot.fullPage !== false });
      }
      const missed = await page.evaluate(() => window.__labMisses ?? []);
      if (missed.length) misses.set(shot.name, [...new Set([...(misses.get(shot.name) ?? []), ...missed])]);
      await page.close();
    }
  }
}

await browser.close();
server.close();
console.log(`${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT}`);
if (misses.size) {
  console.log("\nRequêtes sans donnée factice :");
  for (const [name, list] of misses) console.log(`  ${name}\n    ${list.join("\n    ")}`);
}
if (errors.length) {
  console.error(`\nErreurs de page :\n${errors.join("\n")}`);
  process.exit(1);
}
