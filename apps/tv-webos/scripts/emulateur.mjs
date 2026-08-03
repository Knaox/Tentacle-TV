#!/usr/bin/env node
/**
 * Installe et lance la coquille sur un appareil webOS — émulateur par défaut.
 *
 * Usage :
 *   node scripts/emulateur.mjs install [cible]
 *   node scripts/emulateur.mjs launch  [cible]
 *   node scripts/emulateur.mjs inspect [cible]
 *
 * La cible est un nom d'appareil enregistré par `ares-setup-device` ; sans
 * argument, c'est `emulator`. `inspect` ouvre l'inspecteur distant, seul moyen
 * de lire la console d'un client qui tourne sur le téléviseur.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_CIBLE = resolve(ICI, "..");
const RACINE_DEPOT = resolve(RACINE_CIBLE, "../..");
const SORTIE = resolve(RACINE_CIBLE, "dist-ipk");

const ACTIONS = new Set(["install", "launch", "inspect"]);
const action = process.argv[2];
const cible = process.argv[3] || "emulator";

if (!ACTIONS.has(action)) {
  console.error(`usage : emulateur.mjs <${[...ACTIONS].join("|")}> [cible]`);
  process.exit(1);
}

function identifiantApplication() {
  const appinfo = JSON.parse(readFileSync(resolve(RACINE_CIBLE, "shell/appinfo.json"), "utf8"));
  return appinfo.id;
}

function dernierPaquet() {
  if (!existsSync(SORTIE)) {
    throw new Error("aucun paquet : lancez d'abord `pnpm ipk`");
  }
  const paquets = readdirSync(SORTIE).filter((nom) => nom.endsWith(".ipk")).sort();
  if (paquets.length === 0) {
    throw new Error("aucun .ipk dans dist-ipk : lancez d'abord `pnpm ipk`");
  }
  return resolve(SORTIE, paquets[paquets.length - 1]);
}

function outil(nom, parametres) {
  const binaire = resolve(RACINE_DEPOT, `node_modules/.bin/${nom}`);
  const commande = existsSync(binaire) ? binaire : nom;
  execFileSync(commande, parametres, { stdio: "inherit" });
}

if (action === "install") {
  outil("ares-install", ["--device", cible, dernierPaquet()]);
} else if (action === "launch") {
  outil("ares-launch", ["--device", cible, identifiantApplication()]);
} else {
  outil("ares-inspect", ["--device", cible, "--app", identifiantApplication(), "--open"]);
}
