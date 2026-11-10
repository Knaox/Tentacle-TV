#!/usr/bin/env node
/**
 * Capture l'accueil au Chrome sans tête — la preuve du rendu, en sombre et en clair, à 1440 et
 * à 1024 px : la vraie coquille, la vraie page d'accueil et le labo `/dev/accueil`, sur le
 * serveur factice du banc (`labServer.ts`).
 *
 *   node bench/accueil/capture.mjs [dossier de sortie] [filtre]      (depuis apps/web)
 *
 * `filtre` : ne prend que les vues dont le nom le contient (« barre », « carte »…).
 * Les images sont celles du prototype validé (libres : Blender, domaine public). Elles ne sont
 * PAS dans le dépôt : `ACCUEIL_IMG_DIR`, sinon `bench/accueil/img/`, sinon le dossier
 * `.claude/refonte-ui/prototype/img` d'un parent. Sans elles, les cartes gardent leur couleur
 * d'attente — le banc tourne quand même.
 * `CHROME_PATH` désigne le Chrome à lancer ; à défaut, le chrome-headless-shell de `~/.cache/puppeteer`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

import { SHOTS } from "./shots.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const OUT = resolve(process.argv[2] ?? join(HERE, "captures"));
const FILTER = process.argv[3] ?? "";
const DIST = join(tmpdir(), "tentacle-accueil-lab");
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

function imageDir() {
  if (process.env.ACCUEIL_IMG_DIR) return process.env.ACCUEIL_IMG_DIR;
  if (existsSync(join(HERE, "img"))) return join(HERE, "img");
  for (let dir = HERE; dirname(dir) !== dir; dir = dirname(dir)) {
    const candidate = join(dir, ".claude/refonte-ui/prototype/img");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

if (!process.env.ACCUEIL_SKIP_BUILD) {
  execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });
}

const IMAGES = imageDir();
if (!IMAGES) console.warn("Images du prototype introuvables : les cartes resteront à leur couleur d'attente.");

const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const image = /^\/img\/([\w-]+\.webp)$/.exec(pathname);
  const path = image ? (IMAGES ? join(IMAGES, image[1]) : "") : join(DIST, pathname.replace(/\/$/, "/index.html"));
  if (!path || (!image && !path.startsWith(DIST)) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://accueil.localhost:${server.address().port}/`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP accueil.localhost 127.0.0.1"] });
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

await browser.close();
server.close();
writeFileSync(join(OUT, "routes-sans-reponse.txt"), [...unhandled].sort().join("\n") + "\n");
console.log(`${readdirSync(OUT).filter((f) => f.endsWith(".png")).length} captures dans ${OUT} ; ${unhandled.size} adresse(s) sans réponse du serveur factice.`);
if (errors.length) {
  console.error(`Erreurs :\n${errors.join("\n")}`);
  process.exit(1);
}
