#!/usr/bin/env node
// Sonde d'une scène du labo (déjà construit) : ce que la page a rendu et dit en console.
//   node bench/fiches/probe.mjs "/person/p-cary-grant" [dark|light]
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { chromium } from "playwright-core";

const DIST = join(tmpdir(), "tentacle-fiches-lab");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".webp": "image/webp" };
const root = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
const version = readdirSync(root).sort().reverse()[0];
const chrome = join(root, version, readdirSync(join(root, version))[0], "chrome-headless-shell");
const server = createServer((req, res) => {
  const path = join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!existsSync(path) || statSync(path).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" }).end(readFileSync(path));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const browser = await chromium.launch({ executablePath: chrome, args: ["--host-resolver-rules=MAP fiches.localhost 127.0.0.1"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("ERREUR", e.message, "\n", (e.stack ?? "").split("\n").slice(0, 6).join("\n")));
page.on("console", (m) => console.log(`[${m.type()}]`, m.text().slice(0, 400)));
await page.goto(`http://fiches.localhost:${server.address().port}/?theme=${process.argv[3] ?? "dark"}&route=${encodeURIComponent(process.argv[2] ?? "/")}`);
await page.waitForTimeout(Number(process.argv[4] ?? 2500));
console.log("TEXTE :", (await page.evaluate(() => document.body.innerText)).slice(0, 600).replace(/\n+/g, " | "));
if (process.argv[5]) await page.screenshot({ path: process.argv[5], fullPage: true });
await browser.close();
server.close();
