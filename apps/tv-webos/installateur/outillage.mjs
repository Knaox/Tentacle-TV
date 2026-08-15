/**
 * Ce dont l'installateur a besoin et qui ne le regarde pas : trouver la CLI de
 * LG, l'installer si elle manque, la lancer, et rapatrier le paquet.
 *
 * Ce fichier voyage HORS DU DÉPÔT — il part dans l'archive attachée à la
 * release `webos-latest`, sur l'ordinateur de quelqu'un qui n'a pas cloné le
 * projet. Il ne peut donc rien supposer de son voisinage : ni `node_modules`,
 * ni `pnpm`, ni un quelconque fichier du dépôt.
 */
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

/** Là où l'on installe la CLI si l'ordinateur ne l'a pas déjà. */
export const ATELIER = join(homedir(), ".tentacle-tv", "webos-cli");

/**
 * Le point d'entrée JavaScript d'un outil `ares-*`.
 *
 * On vise le `.js` du paquet plutôt que l'enveloppe de `node_modules/.bin` :
 * sous Windows, le fichier sans extension est un script shell que `spawnSync`
 * ne sait pas lancer — ENOENT —, et son voisin `.CMD` lui est refusé depuis que
 * Node interdit d'exécuter un `.bat`/`.cmd` hors shell — EINVAL. Le même geste
 * vaut alors sur les trois systèmes.
 */
function pointEntree(racine, nom) {
  const chemin = resolve(racine, "node_modules/@webos-tools/cli/bin", `${nom}.js`);
  return existsSync(chemin) ? chemin : null;
}

/**
 * Les endroits où la CLI peut déjà se trouver, du plus proche au plus lointain :
 * à côté du script s'il a été extrait dans le dépôt, puis dans le dépôt
 * lui-même, puis dans notre atelier d'une exécution précédente.
 */
function racinesPossibles() {
  return [ICI, resolve(ICI, ".."), resolve(ICI, "../../.."), ATELIER];
}

/** La première racine qui porte la CLI, ou `null`. C'est bien la RACINE qui est
 *  rendue, pas le chemin de l'outil : `lancerAres` en dérive tous les autres. */
export function localiserAres(nom = "ares-install") {
  return racinesPossibles().find((racine) => pointEntree(racine, nom)) ?? null;
}

/**
 * Installe la CLI dans l'atelier. On passe par un shell UNIQUEMENT ici : sous
 * Windows `npm` est un `.cmd`, que Node refuse de lancer autrement. Aucune
 * donnée saisie par l'utilisateur n'entre dans cette ligne — seulement un
 * chemin que nous avons construit et un nom de paquet en dur.
 */
export function installerAres() {
  mkdirSync(ATELIER, { recursive: true });
  const commande =
    `npm install --prefix "${ATELIER}" @webos-tools/cli@^3.0.0 ` +
    "--no-audit --no-fund --loglevel=error";
  const issue = spawnSync(commande, { shell: true, stdio: "inherit" });
  if (issue.error && issue.error.code === "ENOENT") {
    throw new Error(
      "npm est introuvable. Il est livré avec Node.js — réinstallez Node.js " +
        "depuis https://nodejs.org puis relancez ce script."
    );
  }
  if (issue.status !== 0) {
    throw new Error("l'installation de la CLI webOS de LG a échoué (voir ci-dessus).");
  }
  const racine = localiserAres();
  if (!racine) {
    throw new Error("la CLI webOS s'est installée mais reste introuvable.");
  }
  return racine;
}

/**
 * Lance un outil `ares-*` sans passer par un shell — les valeurs saisies par
 * l'utilisateur transitent en arguments, jamais dans une ligne de commande.
 *
 * `montrer` laisse la sortie de l'outil s'afficher ; sinon elle est capturée et
 * rendue à l'appelant, qui décide seul de ce qu'il en montre.
 */
export function lancerAres(racine, nom, parametres, { montrer = false } = {}) {
  const entree = pointEntree(racine, nom);
  if (!entree) throw new Error(`${nom} est introuvable dans ${racine}`);
  const issue = spawnSync(process.execPath, [entree, ...parametres], {
    stdio: montrer ? "inherit" : "pipe",
    encoding: "utf8",
  });
  const sortie = `${issue.stdout ?? ""}${issue.stderr ?? ""}`.trim();
  return { code: issue.status, sortie };
}

/**
 * Le mode développeur ouvre un petit serveur sur le port 9991, qui sert la clé
 * SSH. Le sonder d'abord permet de distinguer les trois pannes que l'utilisateur
 * confondrait sinon : mauvaise adresse, téléviseur éteint, session expirée.
 */
export async function modeDeveloppeurRepond(adresse) {
  const arret = AbortSignal.timeout(6000);
  try {
    const reponse = await fetch(`http://${adresse}:9991/webos_rsa`, {
      method: "HEAD",
      signal: arret,
    });
    return reponse.ok;
  } catch {
    return false;
  }
}

/** Rapatrie le paquet, en annonçant sa taille — l'attente doit être lisible. */
export async function telecharger(url, destination) {
  const reponse = await fetch(url, { redirect: "follow" });
  if (!reponse.ok) {
    throw new Error(
      `téléchargement impossible (HTTP ${reponse.status}) depuis ${url}\n` +
        "Vérifiez votre connexion, ou qu'une version a bien été publiée."
    );
  }
  const octets = Number(reponse.headers.get("content-length") || 0);
  if (octets > 0) {
    console.log(`      ${(octets / 1024 / 1024).toFixed(1)} Mo à rapatrier…`);
  }
  await pipeline(Readable.fromWeb(reponse.body), createWriteStream(destination));
  return destination;
}
