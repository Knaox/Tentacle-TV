import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Les racines que les tables de substitution désignent.
 *
 * `fileURLToPath` et non `new URL(…).pathname` : ce dernier rend un chemin
 * encodé pour URL, où le moindre espace du chemin du dépôt devient « %20 ».
 * Aucune comparaison avec un identifiant résolu ne peut alors aboutir, et les
 * substitutions passent silencieusement à côté de leur cible.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, "..");

export const WEB = resolve(TARGET, "../web/src");
export const UI = resolve(TARGET, "../../packages/ui/src");
export const API = resolve(TARGET, "../../packages/api-client/src");
export const CLIENT = resolve(TARGET, "client/src");

/**
 * Les paquets npm, remontés à la racine du dépôt (`node-linker=hoisted`). Une
 * substitution de fichier de paquet désigne son point d'entrée ESM : si la
 * disposition change, le greffon signale la substitution jamais déclenchée.
 */
export const MODULES = resolve(TARGET, "../../node_modules");
