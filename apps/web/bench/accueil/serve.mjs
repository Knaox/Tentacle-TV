/**
 * Le socle des bancs de l'accueil : construit la page (`vite build`), la sert sur
 * `accueil.localhost` avec les images du prototype, et lance le Chrome sans tête.
 *
 * Les images sont celles du prototype validé (libres : Blender, domaine public). Elles ne sont
 * PAS dans le dépôt : `ACCUEIL_IMG_DIR`, sinon `bench/accueil/img/`, sinon le dossier
 * `.claude/refonte-ui/prototype/img` d'un parent. Sans elles, les cartes gardent leur couleur
 * d'attente — le banc tourne quand même.
 * `CHROME_PATH` désigne le Chrome à lancer ; à défaut, le chrome-headless-shell de `~/.cache/puppeteer`.
 * `ACCUEIL_SKIP_BUILD=1` reprend la dernière construction.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
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

/** @returns {Promise<{ base: string, browser: import("playwright-core").Browser, close: () => Promise<void> }>} */
export async function startBench() {
  if (!process.env.ACCUEIL_SKIP_BUILD) {
    execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });
  }
  const images = imageDir();
  if (!images) console.warn("Images du prototype introuvables : les cartes resteront à leur couleur d'attente.");

  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const image = /^\/img\/([\w-]+\.webp)$/.exec(pathname);
    const path = image ? (images ? join(images, image[1]) : "") : join(DIST, pathname.replace(/\/$/, "/index.html"));
    if (!path || (!image && !path.startsWith(DIST)) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const browser = await chromium.launch({ executablePath: chromePath(), args: ["--host-resolver-rules=MAP accueil.localhost 127.0.0.1"] });
  return {
    base: `http://accueil.localhost:${server.address().port}/`,
    browser,
    close: async () => {
      await browser.close();
      server.close();
    },
  };
}
