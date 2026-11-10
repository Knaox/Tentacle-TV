#!/usr/bin/env node
// Banc « gel au clic » (Linux, Wayland) : la bulle d'aide d'un bouton paraît sous un VRAI pointeur
// Wayland (périphérique factice de KWin — CDP ne montre jamais de bulle), puis on clique. Relevé :
// ce que le fil principal a retenu (`shell.debug.stalls`), le plus long trou entre deux images
// de la page, et si le clic est arrivé. Voir README.md pour le montage (KWin virtuel, fakeinput).
//
//   node gel.mjs [--port 9411] [--rounds 5] [--json]
//
// FAKEINPUT : le client `org_kde_kwin_fake_input` (README) ; WAYLAND_DISPLAY : le KWin du banc.
import { execFile, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Cdp, pageTarget } = await import(path.join(here, "../../web/shim/dev/cdp.mjs"));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const port = Number(arg("port", 9411));
const rounds = Number(arg("rounds", 5));
const fakeinput = process.env.FAKEINPUT;
if (!fakeinput) throw new Error("FAKEINPUT : chemin du client fake_input (voir README.md)");
const pointer = (...cmds) => execFileSync(fakeinput, cmds.map(String), { stdio: ["ignore", "inherit", "inherit"] });
const pointerAsync = (...cmds) => new Promise((resolve, reject) => execFile(fakeinput, cmds.map(String), (err) => (err ? reject(err) : resolve())));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cdp = await Cdp.connect((await pageTarget(port)).webSocketDebuggerUrl);
const page = (expr) => cdp.eval(expr);
const shell = (channel, params = {}) => page(`__shell.invoke(${JSON.stringify(channel)}, ${JSON.stringify(params)})`);

// Où est la page dans l'écran du compositeur ? Un mouvement, et la page dit où elle l'a vu.
pointer("move", 700, 500, "sleep", 150, "move", 720, 520, "sleep", 250);
const seen = await page("__bench.last");
if (!seen) throw new Error("la page n'a reçu aucun mouvement : fenêtre sans focus, ou pointeur hors de la fenêtre");
const origin = { x: 720 - seen.x, y: 520 - seen.y };
const at = async (id) => {
  const r = await page(`__bench.rect(${JSON.stringify(id)})`);
  return { x: origin.x + r.x, y: origin.y + r.y };
};

const results = [];
for (let i = 0; i < rounds; i++) {
  const id = `b${i % 3}`;
  const target = await at(id);
  const rest = await at("b3");
  // Loin d'abord (un autre survol : la bulle ne revient qu'avec un texte nouveau).
  pointer("move", rest.x, rest.y + 300, "sleep", 300);
  await page("__bench.reset()");
  await shell("shell.debug.stalls", { reset: true });
  // Survol immobile : la bulle paraît (délai de Chromium, 500 ms), puis le clic — le tout dans
  // UN appel : le périphérique factice qui disparaît vaut une sortie de la souris.
  const gesture = pointerAsync("move", target.x - 30, target.y, "sleep", 60, "move", target.x, target.y, "sleep", 1100, "click", "sleep", 500);
  await sleep(950);
  const tooltip = await shell("navigateur.debug.tooltip").catch(() => null);
  await gesture;
  const stalls = await shell("shell.debug.stalls");
  // L'image suit-elle encore ? (9a99daaf6 : la page tournait, l'écran restait figé.) Le carré
  // de la page tourne sans arrêt : en une demi-seconde, des images DOIVENT être présentées.
  const before = (await shell("shell.stats")).presentedFrames;
  await sleep(500);
  const presented = (await shell("shell.stats")).presentedFrames - before;
  const bench = await page("({ clicks: __bench.clicks.length, maxGapMs: Math.round(__bench.maxGapMs), gaps: __bench.gaps })");
  results.push({ round: i + 1, button: id, tooltip: tooltip ? tooltip.shown : null, showMs: tooltip?.lastShowMs ?? null, presented, ...bench, stallMaxMs: Math.round(stalls.maxMs), stallMaxWhat: stalls.maxWhat, stalls: stalls.recent });
}
const costs = await shell("navigateur.debug.tooltip").catch(() => null);
cdp.close();

if (costs?.maxShowMs !== undefined) {
  console.log(`bulle d'aide : ${costs.shows} affichages, afficher ${costs.maxShowMs.toFixed(2)} ms au pire, retirer ${costs.maxHideMs.toFixed(2)} ms au pire (fil principal)`);
}
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(results, null, 1));
} else {
  for (const r of results) {
    const worst = r.stalls.map((s) => `${Math.round(s.ms)} ms ${s.what}${s.detail ? ` (${s.detail})` : ""}`).join(" ; ") || "aucun arrêt ≥ 50 ms";
    console.log(`tour ${r.round} ${r.button} : bulle ${r.tooltip === null ? "?" : r.tooltip ? "affichée" : "ABSENTE"} · clic reçu ${r.clicks === 1 ? "oui" : `NON (${r.clicks})`} · ${r.presented} images présentées en 0,5 s après le clic · plus long trou d'images ${r.maxGapMs} ms · fil principal au pire ${r.stallMaxMs} ms (${r.stallMaxWhat}) · ${worst}`);
  }
}
const frozen = results.some((r) => r.clicks !== 1 || r.presented < 5 || r.stallMaxMs >= 50);
process.exit(frozen ? 1 : 0);
