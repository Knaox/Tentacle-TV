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
import { lancerAres } from "./aresCli.mjs";

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_CIBLE = resolve(ICI, "..");
const RACINE_DEPOT = resolve(RACINE_CIBLE, "../..");
const COQUILLE = resolve(RACINE_CIBLE, "shell");
const SORTIE = resolve(RACINE_CIBLE, "dist-ipk");
const APPINFO = resolve(COQUILLE, "appinfo.json");

function lireVersion() {
  const versions = JSON.parse(readFileSync(resolve(RACINE_DEPOT, "versions.json"), "utf8"));
  const version = versions.webos;
  if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(
      "versions.json : le champ `webos` doit exister et valoir X.Y.Z (trouvé : " +
        JSON.stringify(version) + ")"
    );
  }
  return version;
}

function synchroniserAppinfo(version) {
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
function verifierRessources() {
  const appinfo = JSON.parse(readFileSync(APPINFO, "utf8"));
  const declarees = ["main", "icon", "largeIcon", "bgImage", "splashBackground"];
  const manquantes = declarees
    .map((champ) => appinfo[champ])
    .filter((chemin) => typeof chemin === "string" && chemin.length > 0)
    .filter((chemin) => !existsSync(resolve(COQUILLE, chemin)));
  if (manquantes.length > 0) {
    throw new Error(`ressources déclarées mais absentes de shell/ : ${manquantes.join(", ")}`);
  }
}

function empaqueter() {
  mkdirSync(SORTIE, { recursive: true });
  lancerAres("ares-package", ["--outdir", SORTIE, COQUILLE]);
}

const version = lireVersion();
if (synchroniserAppinfo(version)) {
  console.log(`[ipk] appinfo.json aligné sur versions.json → ${version}`);
}
verifierRessources();
empaqueter();
console.log(`[ipk] paquet écrit dans ${SORTIE}`);
