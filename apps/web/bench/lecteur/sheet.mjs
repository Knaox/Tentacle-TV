#!/usr/bin/env node
/**
 * Planche-contact des captures : `node bench/lecteur/sheet.mjs <sortie.png> <capture.png>…`
 * (depuis apps/web). Quatre captures par planche, légendées — pour les relire d'un coup d'œil.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { chromium } from "playwright-core";

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

const [out, ...files] = process.argv.slice(2);
const cells = files.map((file) => {
  const data = readFileSync(file).toString("base64");
  return `<figure><img src="data:image/png;base64,${data}"><figcaption>${basename(file, ".png")}</figcaption></figure>`;
}).join("");
const html = `<body style="margin:0;background:#333;font:13px sans-serif;color:#fff"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px">${cells}</div><style>figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 4px}</style></body>`;
const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1560, height: 900 } });
await page.setContent(html);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
