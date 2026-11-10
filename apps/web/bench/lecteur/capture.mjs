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
const FILTER = process.argv[3] ?? "";
const DIST = join(tmpdir(), "tentacle-lecteur-lab");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json",
};
const WIDTHS = [[1440, 810], [1024, 640]];

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

if (process.env.LECTEUR_SKIP_BUILD !== "1") {
  execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });
}

const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://lecteur.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP lecteur.localhost 127.0.0.1"] });
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
