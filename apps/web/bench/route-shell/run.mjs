#!/usr/bin/env node
/**
 * Banc « sortie et retour de la coquille » — ce que coûte l'ouverture d'une
 * fiche depuis l'accueil (la coquille entière sort, est démontée, puis se
 * remonte au retour), et si une affiche déjà vue manque à l'écran au retour.
 *
 *   node apps/web/bench/route-shell/run.mjs [--repeat 5] [--chrome <binaire>]
 *
 * 1. Construit la page du banc EN PRODUCTION (vite build, dossier temporaire).
 * 2. La sert en local et l'ouvre dans un Chrome sans tête (CDP).
 * 3. Joue accueil → fiche → retour `--repeat` fois (page rechargée à chaque
 *    fois) et rend la médiane.
 *
 * Ce que le banc ne mesure PAS : le poids de la vraie page d'accueil (ses
 * requêtes, sa bannière, ses survols), le décodage de vraies affiches JPEG, le
 * GPU. Il mesure le MÉCANISME : démontage, remontage, première image rendue.
 */

import { spawn, execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "../..");
const args = new Map(process.argv.slice(2).map((a, i, all) => [a, all[i + 1]]).filter(([a]) => a.startsWith("--")));
const repeat = Number(args.get("--repeat") ?? 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const given = args.get("--chrome") ?? process.env.CHROME_BIN;
  if (given) return given;
  const base = join(homedir(), ".cache/puppeteer/chrome-headless-shell");
  for (const version of existsSync(base) ? readdirSync(base).sort().reverse() : []) {
    for (const folder of readdirSync(join(base, version))) {
      const binary = join(base, version, folder, "chrome-headless-shell");
      if (existsSync(binary)) return binary;
    }
  }
  throw new Error("Chrome sans tête introuvable : --chrome <binaire> ou CHROME_BIN");
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
function serve(root) {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = join(root, decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/$/, "/index.html"));
      if (!path.startsWith(root) || !existsSync(path)) return void res.writeHead(404).end();
      res.writeHead(200, { "Content-Type": TYPES[extname(path)] ?? "application/octet-stream" });
      createReadStream(path).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => done(server));
  });
}

async function evaluateOnce(port, expression) {
  let target;
  for (let i = 0; i < 100 && !target; i += 1) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      // La page du banc, une fois son adresse prise (plus `about:blank`).
      target = pages.find((page) => page.type === "page" && page.url.startsWith("http"));
    } catch {
      /* Chrome n'écoute pas encore */
    }
    if (!target) await sleep(100);
  }
  if (!target) throw new Error("aucune page dans le Chrome du banc");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, ko) => {
    ws.addEventListener("open", ok, { once: true });
    ws.addEventListener("error", ko, { once: true });
  });
  const reply = new Promise((ok) => ws.addEventListener("message", (msg) => ok(JSON.parse(String(msg.data))), { once: true }));
  ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } }));
  const { result, error } = await reply;
  ws.close();
  if (error) throw new Error(`CDP : ${error.message}`);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? "échec dans la page");
  return result.result.value;
}

/** La page se charge encore (contexte détruit par la navigation) : on redemande. */
async function evaluate(port, expression) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await evaluateOnce(port, expression);
    } catch (error) {
      if (attempt >= 5 || !String(error.message).includes("context")) throw error;
      await sleep(300);
    }
  }
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const out = mkdtempSync(join(tmpdir(), "banc-coquille-"));
execFileSync("npx", ["vite", "build", "--config", join(here, "page/vite.config.ts"), "--outDir", out], { cwd: webRoot, stdio: "inherit" });
const server = await serve(out);
const url = `http://127.0.0.1:${server.address().port}/`;
const chrome = findChrome();

const runs = [];
for (let i = 0; i < repeat; i += 1) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = mkdtempSync(join(tmpdir(), "banc-coquille-profil-"));
  const child = spawn(chrome, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-sandbox", "--window-size=1600,900",
    "--hide-scrollbars", "--mute-audio", url,
  ], { stdio: "ignore" });
  try {
    runs.push(await evaluate(port, "new Promise((ok) => { const wait = () => (window.__bench ? ok(window.__bench.run()) : setTimeout(wait, 50)); wait(); })"));
  } finally {
    child.kill();
    await sleep(200);
    rmSync(profile, { recursive: true, force: true });
  }
}
server.close();
rmSync(out, { recursive: true, force: true });

const first = runs[0];
const summary = {
  cartes: first.cards, cartesAEcran: first.cardsOnScreen, noeudsDeLaCoquille: first.shellNodes,
  premierMontageMs: median(runs.map((r) => r.firstMountMs)),
  coquilleDemonteeApresMs: median(runs.map((r) => r.shellGoneMs)),
  retour_remontageMs: median(runs.map((r) => r.remountMs)),
  retour_coquilleRevenueApresMs: median(runs.map((r) => r.shellBackMs)),
  retour_entreeDeLaPageMs: median(runs.map((r) => r.entranceMs)),
  retour_imagesAvecUnTrou: median(runs.map((r) => r.framesWithHoles)),
  retour_affichesManquantesAuPire: Math.max(...runs.map((r) => r.maxHoles)),
  retour_premiereImagePleine: median(runs.map((r) => r.firstFullFrame)),
  trousParImage: first.holesPerFrame,
};
console.log(JSON.stringify({ repeat, summary }, null, 2));
