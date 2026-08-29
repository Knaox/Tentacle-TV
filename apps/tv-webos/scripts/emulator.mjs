#!/usr/bin/env node
/**
 * Installe et lance la coquille sur un appareil webOS — émulateur par défaut.
 *
 * Usage :
 *   node scripts/emulator.mjs install [cible]
 *   node scripts/emulator.mjs launch  [cible]
 *   node scripts/emulator.mjs inspect [cible]
 *
 * La cible est un nom d'appareil enregistré par `ares-setup-device` ; sans
 * argument, c'est `emulator`. `inspect` ouvre l'inspecteur distant, seul moyen
 * de lire la console d'un client qui tourne sur le téléviseur.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAres } from "./aresCli.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET_ROOT = resolve(HERE, "..");
const SORTIE = resolve(TARGET_ROOT, "dist-ipk");

const ACTIONS = new Set(["install", "launch", "inspect"]);
const action = process.argv[2];
const target = process.argv[3] || "emulator";

if (!ACTIONS.has(action)) {
  console.error(`usage : emulator.mjs <${[...ACTIONS].join("|")}> [cible]`);
  process.exit(1);
}

function applicationId() {
  const appinfo = JSON.parse(readFileSync(resolve(TARGET_ROOT, "shell/appinfo.json"), "utf8"));
  return appinfo.id;
}

function lastPackage() {
  if (!existsSync(SORTIE)) {
    throw new Error("aucun paquet : lancez d'abord `pnpm ipk`");
  }
  const packages = readdirSync(SORTIE).filter((nom) => nom.endsWith(".ipk")).sort();
  if (packages.length === 0) {
    throw new Error("aucun .ipk dans dist-ipk : lancez d'abord `pnpm ipk`");
  }
  return resolve(SORTIE, packages[packages.length - 1]);
}

if (action === "install") {
  runAres("ares-install", ["--device", target, lastPackage()]);
} else if (action === "launch") {
  runAres("ares-launch", ["--device", target, applicationId()]);
} else {
  runAres("ares-inspect", ["--device", target, "--app", applicationId(), "--open"]);
}
