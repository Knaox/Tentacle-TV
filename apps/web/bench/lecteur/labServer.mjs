/**
 * Le labo du lecteur, construit et servi — partagé par le banc de capture (`capture.mjs`) et
 * par l'épreuve du blocage de la pop-up de mise à jour (`updateBlock.mjs`).
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, "../..");
const DIST = join(tmpdir(), "tentacle-lecteur-lab");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json",
};

/** `CHROME_PATH`, sinon le chrome-headless-shell de `~/.cache/puppeteer`. */
export function chromePath() {
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

/** Construit la page du labo (`LECTEUR_SKIP_BUILD=1` reprend la dernière construction). */
export function buildLab() {
  if (process.env.LECTEUR_SKIP_BUILD === "1" && existsSync(join(DIST, "index.html"))) return;
  execFileSync("pnpm", ["exec", "vite", "build", "--config", join(HERE, "vite.config.ts"), "--outDir", DIST], { cwd: WEB, stdio: "inherit" });
}

/** Sert la page sur `lecteur.localhost` ; rend son adresse et de quoi l'arrêter. */
export async function serveLab() {
  const server = createServer((req, res) => {
    const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
    if (!path.startsWith(DIST) || !existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return { base: `http://lecteur.localhost:${server.address().port}/`, close: () => server.close() };
}

export const CHROME_ARGS = ["--host-resolver-rules=MAP lecteur.localhost 127.0.0.1"];
