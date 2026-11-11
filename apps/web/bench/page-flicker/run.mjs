#!/usr/bin/env node
/**
 * Banc « scintillement entre deux pages » — image par image, sur une VRAIE instance.
 *
 *   node bench/page-flicker/run.mjs --base http://127.0.0.1:5412 --session <jetons.json>
 *        [--theme dark|light] [--laps 2] [--network fast|slow]
 *        [--cdp http://127.0.0.1:9412 [--sign-in --server http://127.0.0.1:3412]]
 *        [--out <dossier>] [--json <fichier>] [--force]
 *
 * Le parcours (`lib/journey.mjs`) est joué `--laps` fois : le premier tour est la PREMIÈRE
 * visite de chaque page (module paresseux et données à charger), les suivants des revisites.
 * Pour chaque transition : le screencast CDP dit ce que l'écran a montré, la sonde ce que le
 * document contenait, et `lib/analyse.mjs` compte les images parasites.
 *
 * `--network slow` : le serveur DISTANT de l'utilisateur, émulé par CDP (latence et débit, voir
 * `SLOW`) — une instance locale répond en 60 à 200 ms, et le scintillement se voit surtout quand
 * une page attend ses données ou ses images. Le cache d'images est vide au premier tour, chaud
 * ensuite.
 * `--cdp` : rejoint un navigateur déjà ouvert (la coquille CEF) au lieu d'en lancer un ; avec
 * `--sign-in`, pose d'abord la session et le thème dans sa page, puis la recharge.
 * `--out` : garde les images des transitions qui ont un parasite, pour les regarder.
 * Refuse de mesurer une machine chargée (`MAX_LOAD`), sauf `--force` : le screencast saute alors
 * des images et la page rend en retard — on mesurerait la machine.
 * Sort en erreur (code 1) s'il reste une image parasite : c'est le critère du banc.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import { join } from "node:path";

import { analyseTransition } from "./lib/analyse.mjs";
import { openBrowser, readSession, signIn } from "./lib/browser.mjs";
import { captureTransition } from "./lib/capture.mjs";
import { openDecoder } from "./lib/decoder.mjs";
import { journey } from "./lib/journey.mjs";
import { waitUntilReadable } from "./lib/ready.mjs";

/** Le régime « lent » : un serveur chez soi, joint de loin — 400 ms d'aller-retour, ~200 Ko/s. */
const SLOW = { offline: false, latency: 400, downloadThroughput: 200 * 1024, uploadThroughput: 90 * 1024 };
const MAX_LOAD = 20;
/** Ce qu'on regarde après le geste : assez pour voir la page d'arrivée POSÉE (en lent, elle attend ses données). */
const HOLD_MS = { fast: 1600, slow: 3200 };

const argv = process.argv.slice(2);
const args = new Map(argv.map((a, i, all) => [a, all[i + 1]]).filter(([a]) => a.startsWith("--")));
const base = args.get("--base") ?? "http://127.0.0.1:5412";
const theme = args.get("--theme") ?? "dark";
const laps = Number(args.get("--laps") ?? 2);
const network = args.get("--network") ?? "fast";
const out = args.get("--out");
const sessionFile = args.get("--session");
if (!sessionFile) throw new Error("--session <fichier de jetons> est requis");
const load = loadavg()[0];
if (load > MAX_LOAD && !args.has("--force")) {
  console.error(`machine trop chargée (${load.toFixed(1)} > ${MAX_LOAD}) : aucune mesure. --force pour passer outre.`);
  process.exit(2);
}

const decoder = await openDecoder();
const { browser, context, attached } = await openBrowser({ cdp: args.get("--cdp"), width: 1440, height: 900 });
let page;
if (attached) {
  // La coquille : sa page est déjà ouverte (tentacle://app). `--sign-in` y pose la session et le
  // thème, puis la recharge ; `--server` est l'adresse du serveur que le front doit joindre.
  page = context.pages().find((candidate) => !candidate.url().startsWith("devtools://")) ?? context.pages()[0];
  if (!page) throw new Error("aucune page dans le navigateur rejoint");
  if (args.has("--sign-in")) {
    const session = readSession(sessionFile);
    const server = args.get("--server");
    if (server) await context.addCookies([{ name: "tentacle_token", value: session.token, url: server }]).catch(() => undefined);
    await page.evaluate(({ token, user, mode, serverUrl }) => {
      localStorage.setItem("tentacle_token", token);
      localStorage.setItem("tentacle_user", JSON.stringify(user));
      localStorage.setItem("tentacle_theme_mode", mode);
      if (serverUrl) localStorage.setItem("tentacle_server_url", serverUrl);
    }, { token: session.token, user: session.user, mode: theme, serverUrl: server ?? null });
    // Vers l'accueil, pas un simple rechargement : sans session, la page s'était posée sur la connexion.
    await page.goto(new URL("/", page.url()).href, { waitUntil: "domcontentloaded" });
  }
  if (network === "slow") {
    const throttle = await context.newCDPSession(page);
    await throttle.send("Network.enable");
    await throttle.send("Network.emulateNetworkConditions", SLOW);
  }
} else {
  await signIn(context, base, readSession(sessionFile), theme);
  page = await context.newPage();
  if (network === "slow") {
    const throttle = await context.newCDPSession(page);
    await throttle.send("Network.enable");
    await throttle.send("Network.emulateNetworkConditions", SLOW);
  }
  await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
}
const errors = [];
page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
const ready = await waitUntilReadable(page, { timeoutMs: 150000 });
if (ready.veil) throw new Error("la page reste sous le voile « hors ligne » : instance injoignable");
await page.waitForTimeout(2500);

const steps = journey();
const results = [];
for (let lap = 1; lap <= laps; lap += 1) {
  for (const step of steps) {
    await step.before?.(page);
    if (step.before) await page.waitForTimeout(900);
    let failure = null;
    const fail = (error) => { failure = String(error.message ?? error).split("\n")[0]; };
    // Le pointeur se pose d'abord : le survol de la cible est l'état de départ, pas la transition.
    if (step.aim) {
      await step.aim(page).catch(fail);
      await page.waitForTimeout(500);
    }
    const capture = failure
      ? await captureTransition(page, async () => undefined, decoder, { holdMs: 200 })
      : await captureTransition(page, () => step.gesture(page).catch(fail), decoder, { holdMs: HOLD_MS[network] ?? HOLD_MS.fast });
    const path = await page.evaluate(() => location.pathname);
    const result = analyseTransition(capture);
    const arrived = failure === null && step.arrives.test(path);
    if (failure) console.error(`tour ${lap} ${step.id} : ${failure} (page : ${path})`);
    results.push({ lap, id: step.id, arrived, path, ...result });
    if (out && (result.parasites > 0 || args.has("--keep-all"))) {
      const dir = join(out, `${theme}-${network}-tour${lap}-${step.id.replace(/[^\p{L}\d]+/gu, "_")}`);
      mkdirSync(dir, { recursive: true });
      capture.frames.forEach((frame, index) => writeFileSync(join(dir, `${String(index).padStart(3, "0")}_${Math.round(frame.t - capture.gestureAt)}ms.jpg`), Buffer.from(frame.jpeg, "base64")));
      writeFileSync(join(dir, "lignes.json"), JSON.stringify({ rows: result.rows, probe: capture.probe }, null, 1));
    }
    // La page d'arrivée finit de se poser (images, requêtes) avant le geste suivant.
    await waitUntilReadable(page, { timeoutMs: 45000, needCards: step.cards !== false });
    await page.waitForTimeout(1200);
  }
}
await browser.close().catch(() => undefined);
await decoder.close();

const line = (r) => [
  `tour ${r.lap}`, r.id.padEnd(28), r.arrived ? "            " : "(PAS ARRIVÉ)",
  `images ${String(r.frames).padStart(3)}`, `posée à ${String(r.settleMs ?? "?").padStart(4)} ms`,
  `clarté ${r.lumaFrom}→${r.lumaTo} [${r.lumaMin}…${r.lumaMax}]`.padEnd(34),
  `PARASITES ${String(r.parasites).padStart(3)}`,
  `pixels : éclair ${r.flash ?? "?"}, recul ${r.regress ?? "?"}, vide ${r.blank ?? "?"}`.padEnd(40),
  `document : anneau ${r.document.spinner}, sans page ${r.document.empty}, barre ${r.document.navAbsent}, retour d'opacité ${r.document.revert}`,
  `tenue ${String(r.document.heldMs).padStart(4)} ms`,
].join("  ");
console.log(results.map(line).join("\n"));
const total = (pick) => results.reduce((sum, r) => sum + (pick(r) ?? 0), 0);
const summary = {
  theme, network, laps, load: Number(load.toFixed(1)), transitions: results.length, notArrived: results.filter((r) => !r.arrived).length,
  parasites: total((r) => r.parasites), flash: total((r) => r.flash), regress: total((r) => r.regress), blank: total((r) => r.blank),
  spinner: total((r) => r.document.spinner), empty: total((r) => r.document.empty), navAbsent: total((r) => r.document.navAbsent), revert: total((r) => r.document.revert),
  longestHoldMs: Math.max(...results.map((r) => r.document.heldMs)),
  widestGapMs: Math.max(...results.map((r) => r.widestGapMs ?? 0)), pageErrors: errors.length,
};
console.log(JSON.stringify(summary));
if (args.get("--json")) writeFileSync(args.get("--json"), JSON.stringify({ summary, results: results.map(({ rows: _rows, ...rest }) => rest), errors }, null, 1));
process.exit(summary.parasites + summary.notArrived > 0 ? 1 : 0);
