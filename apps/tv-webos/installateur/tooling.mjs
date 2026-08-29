/**
 * Ce dont l'installateur a besoin et qui ne le regarde pas : trouver la CLI de
 * LG, l'installer si elle manque, la lancer, et rapatrier le paquet.
 *
 * Ce fichier voyage HORS DU DÉPÔT — il part dans l'archive attachée à la
 * release `webos-latest`, sur l'ordinateur de quelqu'un qui n'a pas cloné le
 * projet. Il ne peut donc rien supposer de son voisinage : ni `node_modules`,
 * ni `pnpm`, ni un quelconque fichier du dépôt. Ni, surtout, que la machine
 * ressemble à celle où ce code a été écrit.
 */
import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

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
  const path = resolve(racine, "node_modules/@webos-tools/cli/bin", `${nom}.js`);
  return existsSync(path) ? path : null;
}

/**
 * Les endroits où la CLI peut déjà se trouver, du plus proche au plus lointain :
 * à côté du script s'il a été extrait dans le dépôt, puis dans le dépôt
 * lui-même, puis dans notre atelier d'une exécution précédente.
 */
function possibleRoots() {
  return [HERE, resolve(HERE, ".."), resolve(HERE, "../../.."), ATELIER];
}

/** La première racine qui porte la CLI, ou `null`. C'est bien la RACINE qui est
 *  rendue, pas le chemin de l'outil : `runAres` en dérive tous les autres. */
export function locateAres(nom = "ares-install") {
  return possibleRoots().find((racine) => pointEntree(racine, nom)) ?? null;
}

/**
 * La CLI répond-elle vraiment ?
 *
 * Sa PRÉSENCE ne prouve rien. Une installation qui n'a rapatrié que le paquet
 * racine laisse tous les fichiers attendus en place, et l'outil ne meurt qu'au
 * premier `require` d'une dépendance manquante — trois étapes plus loin, sur
 * une trace Node incompréhensible pour qui voulait juste installer une
 * application. On lui fait donc dire sa version avant de compter dessus.
 */
export function aresUsable(racine) {
  if (!racine) return false;
  try {
    return runAres(racine, "ares-setup-device", ["--version"]).code === 0;
  } catch {
    return false;
  }
}

/**
 * Ancre l'installation : un `package.json`, si minimal soit-il, fait traiter
 * l'atelier comme un projet à part entière plutôt que comme un dossier trouvé
 * au milieu de l'arborescence de quelqu'un. Ce n'est pas ce qui a cassé sous
 * Windows — voir `runNpm` —, mais c'est ce qui rend l'installation
 * reproductible : npm y écrit son `package-lock.json` et ne va rien chercher
 * dans les dossiers parents.
 */
function poserLAtelier(purger) {
  if (purger) rmSync(ATELIER, { recursive: true, force: true });
  mkdirSync(ATELIER, { recursive: true });
  writeFileSync(
    join(ATELIER, "package.json"),
    `${JSON.stringify({ name: "tentacle-tv-webos-cli", version: "1.0.0", private: true }, null, 2)}\n`,
    "utf8"
  );
}

/**
 * LA LIGNE QUI A CASSÉ WINDOWS, et pourquoi elle est maintenant écrite ainsi.
 *
 * Elle demandait `@webos-tools/cli@^3.0.0`. Or on passe forcément par un shell
 * — sous Windows `npm` est un `.cmd`, que Node refuse de lancer autrement —, et
 * `^` est le caractère d'échappement de `cmd.exe` : il le MANGE avant que npm
 * ne le voie. Windows installait donc `@3.0.0`, version exacte, qui se pose
 * sans aucune de ses dépendances — « added 1 package » au lieu de trois cents.
 * L'outil ne mourait que trois étapes plus tard, sur `Cannot find module
 * 'async'`. Sur macOS, `sh` laisse le `^` tranquille, `^3.0.0` résout vers
 * 3.2.5, et rien ne laissait deviner le problème.
 *
 * D'où une ligne qu'aucun interpréteur n'a de raison de retoucher :
 *
 *   • `@3` — un intervalle valide pour npm, sans un seul caractère spécial ;
 *   • aucun chemin : le dossier passe par `cwd`, donc plus rien à protéger, et
 *     « C:\Users\Prénom Nom\… » ne peut plus être coupé sur son espace.
 *
 * `COMMANDE` est exportée pour que le test puisse la relire : la règle est
 * qu'elle ne doit contenir ni `^`, ni guillemet, ni chemin.
 */
export const NPM_COMMAND =
  "npm install @webos-tools/cli@3 --omit=dev --no-audit --no-fund --loglevel=error";

function runNpm() {
  const issue = spawnSync(NPM_COMMAND, { shell: true, stdio: "inherit", cwd: ATELIER });
  if (issue.error && issue.error.code === "ENOENT") {
    throw new Error(
      "npm est introuvable. Il est livré avec Node.js — réinstallez Node.js " +
        "depuis https://nodejs.org puis relancez ce script."
    );
  }
  return issue.status === 0;
}

/**
 * Installe la CLI, et ne rend la main que si elle FONCTIONNE. La seconde
 * tentative repart d'un dossier vide : un arbre incomplet est un arbre que npm
 * tient pour satisfait, et qu'il ne complétera donc jamais.
 */
export function installerAres({ purger = false } = {}) {
  poserLAtelier(purger);
  runNpm();
  let racine = locateAres();
  if (aresUsable(racine)) return racine;

  poserLAtelier(true);
  runNpm();
  racine = locateAres();
  if (aresUsable(racine)) return racine;

  throw new Error(
    "la CLI webOS de LG s'est installée mais ne fonctionne pas.\n\n" +
      `  Le dossier concerné est :\n    ${ATELIER}\n\n` +
      "  Supprimez-le et relancez ce script. Si le problème persiste, c'est\n" +
      "  que npm n'a pas pu tout télécharger — vérifiez la connexion, ou un\n" +
      "  antivirus ou pare-feu d'entreprise qui filtrerait registry.npmjs.org."
  );
}

/**
 * Lance un outil `ares-*` sans passer par un shell — les valeurs saisies par
 * l'utilisateur transitent en arguments, jamais dans une ligne de commande.
 *
 * `show` laisse la sortie de l'outil s'afficher ; sinon elle est capturée et
 * rendue à l'appelant, qui décide seul de ce qu'il en montre.
 */
export function runAres(racine, nom, params, { show = false } = {}) {
  const entree = pointEntree(racine, nom);
  if (!entree) throw new Error(`${nom} est introuvable dans ${racine}`);
  const issue = spawnSync(process.execPath, [entree, ...params], {
    stdio: show ? "inherit" : "pipe",
    encoding: "utf8",
  });
  const sortie = `${issue.stdout ?? ""}${issue.stderr ?? ""}`.trim();
  return { code: issue.status, sortie };
}

/**
 * Le mode développeur ouvre un petit serveur sur le port 9991, qui sert la clé
 * SSH. Le sonder d'abord permet de distinguer les pannes que l'utilisateur
 * confondrait sinon : Key Server éteint, mauvaise adresse, téléviseur ailleurs.
 */
export async function devModeAnswers(address) {
  const stop = AbortSignal.timeout(6000);
  try {
    const response = await fetch(`http://${address}:9991/webos_rsa`, {
      method: "HEAD",
      signal: stop,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Rapatrie le paquet, en annonçant sa taille — l'attente doit être lisible. */
export async function download(url, destination) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(
      `téléchargement impossible (HTTP ${response.status}) depuis ${url}\n` +
        "Vérifiez votre connexion, ou qu'une version a bien été publiée."
    );
  }
  const bytes = Number(response.headers.get("content-length") || 0);
  if (bytes > 0) {
    console.log(`      ${(bytes / 1024 / 1024).toFixed(1)} Mo à rapatrier…`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
  return destination;
}
