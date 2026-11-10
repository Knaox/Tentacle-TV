// Linux IMMUABLE (Bazzite, Silverblue, Kinoite…) : la commande d'installation que le lanceur
// propose (`sudo dnf install …`) y est impossible, le système est en lecture seule. Les paquets
// de développement vivent alors dans une boîte distrobox, et `pnpm dev:cef` tapé sur l'hôte se
// REJOUE dedans, tel quel — même dossier, mêmes arguments, mêmes variables.
//
//   TENTACLE_CEF_BOX=<nom>   la boîte à employer (défaut : tentacle-cef) ; donnée sur un hôte
//                            ordinaire, elle y force aussi le passage par la boîte
//   TENTACLE_CEF_BOX=off     ne jamais passer par une boîte
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { capture, die, platform, say, which } from "./common.mjs";

export const DEFAULT_BOX = "tentacle-cef";

/** Les noms des boîtes, lus dans la sortie de `distrobox list` (colonnes séparées par « | »). */
export function parseBoxNames(listOutput) {
  return String(listOutput || "")
    .split("\n")
    .slice(1) // l'en-tête
    .map((line) => line.split("|")[1]?.trim())
    .filter(Boolean);
}

/**
 * Faut-il rejouer le lanceur dans une boîte ? Règle pure.
 *  - `none` : on reste ici (pas Linux, déjà dans un conteneur, coupé, hôte ordinaire sans demande) ;
 *  - `enter` : on se rejoue dans `box` ;
 *  - `no-distrobox` / `no-box` : il le faudrait, mais l'outil ou la boîte manque — à dire.
 */
export function boxDecision({ platform: os, inContainer, immutable, boxEnv, hasDistrobox, boxes }) {
  if (os !== "linux" || inContainer || boxEnv === "off") return { kind: "none" };
  const asked = Boolean(boxEnv);
  if (!immutable && !asked) return { kind: "none" };
  const box = boxEnv || DEFAULT_BOX;
  if (!hasDistrobox) return { kind: "no-distrobox", box };
  if (!boxes.includes(box)) return { kind: "no-box", box };
  return { kind: "enter", box };
}

function inContainer() {
  return Boolean(process.env.CONTAINER_ID) || fs.existsSync("/run/.containerenv") || fs.existsSync("/.dockerenv");
}

/**
 * Un chemin du dossier personnel, dit par son nom LOGIQUE (`$HOME`). Sur un système ostree,
 * `/home` est un lien vers `/var/home` et Node rend le chemin réel ; dans la boîte les deux
 * existent, distincts. Le build (CMake) retient le chemin de ses sources : la boîte doit voir
 * le même que d'habitude, celui de `$HOME`.
 */
export function logicalHomePath(file, home, realHome) {
  if (realHome !== home && (file === realHome || file.startsWith(realHome + path.sep))) return home + file.slice(realHome.length);
  return file;
}

/**
 * La commande jouée dans la boîte. distrobox ne transmet pas le PATH de l'hôte : le dossier du
 * Node qui tourne ici (et celui de pnpm) passe en tête de celui de la boîte — le dossier
 * personnel est partagé, le même Node s'y trouve.
 */
export function boxCommand(box, { node, pnpm, script, args }) {
  const dirs = [...new Set([path.dirname(node), pnpm ? path.dirname(pnpm) : null].filter(Boolean))];
  const setPath = 'PATH="$0:$PATH"; export PATH; exec "$@"';
  return ["enter", box, "--", "sh", "-c", setPath, dirs.join(path.delimiter), node, script, ...args];
}

/**
 * Rejoue le lanceur dans la boîte s'il le faut. Rend le code de sortie de la commande rejouée,
 * ou `null` quand le lanceur doit continuer ici.
 */
export async function reenterInBox(script, args) {
  const boxEnv = process.env.TENTACLE_CEF_BOX || "";
  const hasDistrobox = platform === "linux" && Boolean(which("distrobox"));
  const decision = boxDecision({
    platform,
    inContainer: inContainer(),
    immutable: fs.existsSync("/run/ostree-booted"),
    boxEnv,
    hasDistrobox,
    boxes: hasDistrobox ? parseBoxNames(capture("distrobox", ["list", "--no-color"])) : [],
  });
  if (decision.kind === "none") return null;
  if (decision.kind === "no-distrobox") {
    die(`système immuable : les paquets de développement s'installent dans une boîte distrobox, et distrobox est absent — l'installer, puis créer la boîte « ${decision.box} »`);
  }
  if (decision.kind === "no-box") {
    console.error(`dev : système immuable : la boîte distrobox « ${decision.box} » n'existe pas.`);
    console.error(`      distrobox create --name ${decision.box} --image registry.fedoraproject.org/fedora:44   (ajouter --nvidia avec une carte NVIDIA)`);
    console.error("      puis relancer pnpm dev:cef : le lanceur dira, dans la boîte, les paquets à y installer.");
    die(`créer la boîte « ${decision.box} » puis relancer pnpm dev:cef (autre nom : TENTACLE_CEF_BOX)`);
  }
  const home = os.homedir();
  let realHome = home;
  try {
    realHome = fs.realpathSync(home);
  } catch {}
  const logical = (file) => (file ? logicalHomePath(file, home, realHome) : file);
  const command = boxCommand(decision.box, { node: logical(process.execPath), pnpm: logical(which("pnpm")), script: logical(script), args });
  say(`le lanceur se rejoue dans la boîte distrobox « ${decision.box} » (TENTACLE_CEF_BOX=off pour rester ici)`);
  return new Promise((resolve) => {
    const child = spawn("distrobox", command, { stdio: "inherit" });
    // Le signal atteint aussi la boîte (même groupe de processus) : on l'attend sans mourir avant elle.
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => {});
    child.on("error", (e) => {
      console.error(`dev : distrobox n'a pas pu être lancé : ${e.message}`);
      resolve(1);
    });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
}
