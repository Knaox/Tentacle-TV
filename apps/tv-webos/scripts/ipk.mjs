#!/usr/bin/env node
/**
 * Fabrique le paquet IPK de la coquille.
 *
 * Le paquet ne contient QUE la coquille : le client React est servi par le
 * serveur Tentacle sur `/tv`. C'est ce qui permet de corriger le client par
 * une mise à jour du serveur, sans repasser par la revue du LG Content Store.
 * Un IPK n'est donc à re-soumettre que pour l'icône, le titre, le splash,
 * l'identifiant, ou le comportement de la coquille elle-même.
 *
 * La version vient de `versions.json` — source unique, comme pour toutes les
 * autres cibles du dépôt. Le script la reporte dans `appinfo.json` avant
 * d'empaqueter, pour que les deux ne puissent pas diverger.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runAres } from "./aresCli.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(TARGET_ROOT, "../..");
const SHELL = resolve(TARGET_ROOT, "shell");
const OUTPUT = resolve(TARGET_ROOT, "dist-ipk");
const APPINFO = resolve(SHELL, "appinfo.json");

function readVersion() {
  const versions = JSON.parse(readFileSync(resolve(REPO_ROOT, "versions.json"), "utf8"));
  const version = versions.webos;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      "versions.json : le champ `webos` doit exister et valoir X.Y.Z (trouvé : " +
        JSON.stringify(version) + ")"
    );
  }
  return version;
}

function syncAppinfo(version) {
  const appinfo = JSON.parse(readFileSync(APPINFO, "utf8"));
  if (appinfo.version === version) return false;
  appinfo.version = version;
  writeFileSync(APPINFO, `${JSON.stringify(appinfo, null, 2)}\n`, "utf8");
  return true;
}

/**
 * `ares-package` refuse silencieusement un paquet dont une ressource déclarée
 * manque : l'IPK se construit, l'installation échoue sur le téléviseur. On
 * vérifie donc les chemins d'`appinfo.json` avant d'appeler l'outil.
 */
function checkResources() {
  const appinfo = JSON.parse(readFileSync(APPINFO, "utf8"));
  const declared = ["main", "icon", "largeIcon", "bgImage", "splashBackground"];
  const missing = declared
    .map((field) => appinfo[field])
    .filter((path) => typeof path === "string" && path.length > 0)
    .filter((path) => !existsSync(resolve(SHELL, path)));
  if (missing.length > 0) {
    throw new Error(`ressources déclarées mais absentes de shell/ : ${missing.join(", ")}`);
  }
}

function pack() {
  mkdirSync(OUTPUT, { recursive: true });
  runAres("ares-package", ["--outdir", OUTPUT, SHELL]);
}

const version = readVersion();
if (syncAppinfo(version)) {
  console.log(`[ipk] appinfo.json aligné sur versions.json → ${version}`);
}
checkResources();
pack();
console.log(`[ipk] paquet écrit dans ${OUTPUT}`);
