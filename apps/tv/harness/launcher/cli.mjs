#!/usr/bin/env node
// Provisoire — à retirer quand la refonte remplace l'UI TV (fusion dans main).
//
// Le lanceur de la refonte de l'UI Apple TV, pour l'utilisateur, en une
// commande (depuis la racine du dépôt) :
//   pnpm tv:refonte [--rebuild]   l'app réelle, refondue, au simulateur
//   pnpm tv:banc [commande…]      le banc UI ; avec une commande, la lui passe
//   pnpm tv:stop                  éteint ce que les deux ont lancé
// Mode d'emploi et retrait : docs/TV-REFONTE.md, « Tester la refonte ».
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  APP_DIR, LauncherError, REPO, STATE_DIR, capture, isAlive, loadState, note, sameDir, say, shortPath, step, stopProcess,
  updateState, warn,
} from "./runtime.mjs";
import {
  BACKEND_URL, awaitBenchCatalogue, awaitFirstBundle, ensureBackend, ensureBench, ensureMetro, logSize, pairingPageServed,
} from "./services.mjs";
import {
  BANC_SIM, REFONTE_SIM, boot, bringToFront, ensureDevice, launchOnMetro, pointAppAt, quitSimulatorIfIdle, shutdownDedicated,
} from "./simulator.mjs";
import { ensureApp } from "./nativeBuild.mjs";

const BENCH_SCRIPT = path.join(APP_DIR, "harness/ui-bench/bench.mjs");

function header(title) {
  const branch = capture("git", ["-C", REPO, "branch", "--show-current"])?.trim() || "HEAD détachée";
  say(`${title} — lanceur provisoire, le temps de la refonte`);
  say(`  dossier : ${REPO} (branche ${branch})`);
  say();
}

function requireDependencies() {
  if (process.platform !== "darwin") throw new LauncherError("Apple TV oblige : ce lanceur ne tourne que sur macOS");
  if (!capture("xcrun", ["simctl", "help"])) throw new LauncherError("Xcode et ses outils en ligne de commande sont requis (xcrun simctl)");
  if (!fs.existsSync(path.join(APP_DIR, "node_modules"))) throw new LauncherError("dépendances absentes dans ce dossier : lancez d'abord « pnpm install »");
}

/** Le simulateur dédié `name`, démarré (créé au besoin). */
function readyDevice(name) {
  const { device, created } = ensureDevice(name);
  step("Simulateur", created ? `« ${name} » créé (${created})` : `« ${name} » (${device.udid})`);
  if (device.state !== "Booted") {
    boot(device);
    note("démarré");
  }
  return device;
}

async function refonte(args) {
  const force = args.includes("--rebuild");
  header("Refonte de l'UI Apple TV");
  requireDependencies();
  const backendUp = await ensureBackend();
  const metro = await ensureMetro();
  const device = readyDevice(REFONTE_SIM);
  await ensureApp(device.udid, { force });
  await bringToFront(device.udid);
  const since = logSize(metro.record);
  launchOnMetro(device.udid, metro.port);
  step("App", `lancée sur le Metro du port ${metro.port}, Simulator.app au premier plan (menu Window si une autre fenêtre cache « ${REFONTE_SIM} »)`);
  const bundle = await awaitFirstBundle(metro.record, since);
  if (bundle?.ok) note("code JavaScript chargé depuis Metro");
  else if (bundle) warn(`Metro signale une erreur : ${bundle.line} — journal : ${shortPath(metro.record.log)}`);
  else note("le premier chargement du code prend jusqu'à une minute ; la fenêtre du simulateur le montre");

  say();
  say("Jumeler l'Apple TV (une fois, avec VOTRE compte — le lanceur n'y touche pas) :");
  if (!backendUp) say("  (pas de backend de dev : voir l'avertissement plus haut)");
  say(`  1. Sur la TV : « Français » en bas s'il le faut, puis « Configurer manuellement », adresse ${BACKEND_URL}`);
  say("     (dans la fenêtre du simulateur, le clavier du Mac tape dans le champ).");
  if (await pairingPageServed()) say(`  2. Un code s'affiche : ouvrez ${BACKEND_URL}/pair-device, connectez-vous, saisissez-le.`);
  else say("  2. Un code s'affiche : saisissez-le dans « Jumeler un appareil » d'un client Tentacle connecté à ce backend.");
  say("  Le jumelage reste sur ce simulateur : les lancements suivants arrivent directement sur l'accueil.");
  say();
  say("Télécommande : flèches = pavé, Entrée = OK, Échap = Menu (ou Window › Show Apple TV Remote).");
  say("Une retouche JavaScript se voit aussitôt ; une retouche native se reconstruit au prochain « pnpm tv:refonte ».");
  say("Tout arrêter : pnpm tv:stop");
}

/** `pnpm tv:banc <commande…>` : la commande du banc, sur les ports et le
 *  simulateur du banc lancé par le lanceur. */
function forwardToBench(args) {
  const bench = loadState().banc;
  if (!isAlive(bench)) throw new LauncherError("le banc du lanceur ne tourne pas : « pnpm tv:banc » d'abord");
  if (!sameDir(bench.cwd, APP_DIR)) note(`(banc lancé depuis ${bench.cwd})`);
  const env = { ...process.env, BENCH_PORT: String(bench.benchPort), METRO_PORT: String(bench.metroPort), BENCH_SIM_NAME: BANC_SIM };
  const result = spawnSync(process.execPath, [BENCH_SCRIPT, ...args], { cwd: APP_DIR, env, stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}

async function banc(args) {
  if (args.length) return forwardToBench(args);
  header("Banc UI de la refonte TV");
  requireDependencies();
  const bench = await ensureBench();
  const device = readyDevice(BANC_SIM);
  await ensureApp(device.udid);
  // Déjà branchée sur le relais, l'app n'oblige pas « bench:ui sim » à éteindre
  // le simulateur pour l'y brancher (sa fenêtre rouvrirait derrière les autres).
  pointAppAt(device.udid, bench.benchPort);
  await bringToFront(device.udid);
  step("Banc UI", "« bench:ui sim » : app du banc branchée sur son relais, lancée");
  const env = { ...process.env, BENCH_PORT: String(bench.benchPort), METRO_PORT: String(bench.metroPort), BENCH_SIM_NAME: BANC_SIM };
  const sim = spawnSync(process.execPath, [BENCH_SCRIPT, "sim"], { cwd: APP_DIR, env, encoding: "utf8" });
  for (const line of `${sim.stdout}${sim.stderr}`.trim().split("\n").filter(Boolean)) note(line);
  if (sim.status !== 0) throw new LauncherError(`« bench:ui sim » a échoué — journal du banc : ${shortPath(bench.log)}`);
  const scenes = await awaitBenchCatalogue(bench);
  if (scenes) note(`catalogue publié au relais : ${scenes} scènes — le banc est pilotable`);
  else warn(`l'app du banc n'a pas publié son catalogue en 4 min — journal : ${shortPath(bench.log)}`);

  say();
  if (!fs.existsSync(path.join(APP_DIR, "harness/ui-bench/snapshot/snapshot.json"))) {
    say("Pas d'instantané dans ce dossier : les scènes montrent leurs états vides (voir le README du banc, « L'instantané »).");
  }
  say(`Dans Simulator.app, fenêtre « ${BANC_SIM} » (menu Window si une autre la cache) : le catalogue des scènes ;`);
  say("flèches, Entrée, Échap (Menu revient au catalogue).");
  say("Piloter le banc, avec les commandes de son README (planche, scene, shot, glass, lang…) :");
  say("  pnpm tv:banc planche accueil --focus");
  say("Tout arrêter : pnpm tv:stop");
}

async function stop() {
  header("Arrêt du lanceur");
  const state = loadState();
  let nothing = true;
  for (const [key, label] of [["banc", "Banc UI (Metro + relais)"], ["metro", "Metro de la refonte"], ["backend", "Backend de dev"]]) {
    const record = state[key];
    if (!record) continue;
    const stopped = await stopProcess(record);
    step(label, stopped ? `arrêté (lancé par le lanceur, pid ${record.pid})` : "déjà arrêté");
    updateState((next) => { delete next[key]; });
    nothing = false;
  }
  for (const name of shutdownDedicated()) {
    step("Simulateur", `« ${name} » éteint (il reste installé : le prochain lancement le reprend)`);
    nothing = false;
  }
  if (quitSimulatorIfIdle()) step("Simulator.app", "refermé (plus aucun appareil démarré)");
  if (nothing) say("Rien à arrêter : le lanceur n'a rien en marche.");
  if (!state.backend && capture("lsof", ["-nP", "-iTCP:3001", "-sTCP:LISTEN", "-t"])) {
    note("le backend de dev qui tourne sur 3001 n'a pas été lancé par le lanceur : laissé en marche");
  }
}

function help() {
  say("Lanceur provisoire de la refonte de l'UI Apple TV (depuis la racine du dépôt) :");
  say("  pnpm tv:refonte [--rebuild]   backend de dev, Metro, app refondue au simulateur « Tentacle TV — refonte »");
  say("  pnpm tv:banc                  banc UI (bench:ui up en arrière-plan + bench:ui sim) au simulateur « Tentacle TV — banc UI »");
  say("  pnpm tv:banc <commande…>      une commande du banc (planche, scene, shot…) sur ce banc-là");
  say("  pnpm tv:stop                  éteint ce que les deux ont lancé");
  say(`Journaux et état : ${shortPath(STATE_DIR)}. Mode d'emploi : docs/TV-REFONTE.md, « Tester la refonte ».`);
}

const [command = "help", ...args] = process.argv.slice(2);
const commands = { refonte, banc, stop, help };
const run = commands[command] ?? (() => {
  help();
  throw new LauncherError(`commande inconnue : ${command}`);
});
Promise.resolve().then(() => run(args)).catch((error) => {
  say();
  console.error(`✗ ${error instanceof LauncherError ? error.message : error.stack ?? error.message}`);
  process.exit(1);
});
