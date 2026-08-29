/**
 * Lance un outil de la CLI webOS installée par le dépôt.
 *
 * Les enveloppes de `node_modules/.bin` ne sont pas exécutables partout : sous
 * Windows, le fichier sans extension est un script shell que `spawnSync` ne
 * sait pas lancer — ENOENT —, et son voisin `.CMD` lui est refusé depuis que
 * Node interdit d'exécuter un `.bat`/`.cmd` hors shell — EINVAL. On vise donc
 * le point d'entrée JavaScript du paquet et on le confie à l'interpréteur
 * courant : même geste sur les trois systèmes, sans passer par un shell.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET_ROOT = resolve(HERE, "..");
const REPO_ROOT = resolve(TARGET_ROOT, "../..");

/** Le paquet est déclaré par cette cible, mais pnpm peut l'avoir lié à la racine. */
function pointEntree(nom) {
  const candidates = [TARGET_ROOT, REPO_ROOT].map((racine) =>
    resolve(racine, `node_modules/@webos-tools/cli/bin/${nom}.js`)
  );
  return candidates.find(existsSync);
}

export function runAres(nom, params) {
  const entree = pointEntree(nom);
  // Sans le paquet, on tente l'outil du PATH : un SDK LG installé à part le
  // fournit, et le message d'erreur reste alors celui de l'outil.
  if (!entree) {
    execFileSync(nom, params, { stdio: "inherit" });
    return;
  }
  execFileSync(process.execPath, [entree, ...params], { stdio: "inherit" });
}
