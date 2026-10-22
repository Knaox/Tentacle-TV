/**
 * Le garde-fou du choix de session : un réglage ne doit JAMAIS briquer l'app.
 *
 * # Le piège, vécu le 27.08.2026
 *
 * L'utilisateur choisit `x11` dans les Préférences ; or sur son poste XWayland
 * ne sait pas afficher (Mesa `dri_gbm.so` refusé — SELinux). Le processus GPU
 * de Chromium meurt en boucle, la fenêtre ne se montre jamais… et le réglage
 * fautif est PERSISTANT : chaque relance rejoue l'échec. Sans fenêtre, pas de
 * Préférences — l'application est briquée. Le choix `wayland` imposé porte le
 * même risque (un compositeur qui refuse, et plus aucun repli — voir
 * `graphicsSession.ts`). Seul `auto` est sans danger : Electron y garde son
 * propre repli.
 *
 * # Les deux filets, indépendants
 *
 * 1. **La surveillance du processus GPU** (`watchGpu`) : trois morts
 *    violentes pendant qu'un choix explicite est en vigueur → le choix est
 *    réécrit en `auto` et l'application se RELANCE d'elle-même. L'utilisateur
 *    voit un clignotement, puis une fenêtre — pas un écran vide.
 * 2. **Le témoin d'affichage** : posé quand un choix explicite s'applique,
 *    effacé à la PREUVE d'affichage (`ready-to-show`). S'il est encore là au
 *    lancement suivant, c'est que le dernier essai de ce choix n'a jamais
 *    montré de fenêtre — quel que soit le mode d'échec — et le choix revient à
 *    `auto`. Faux positif possible (app tuée avant sa première image) : le
 *    coût est un réglage remis à `auto`, le gain est de ne jamais rester noir.
 *
 * `TENTACLE_LINUX_SESSION` court-circuite tout : c'est l'outil d'essai des
 * développeurs, il ne touche pas au réglage et ne doit pas être « secouru ».
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SESSION_FILE, type SessionChoice } from "./graphicsSession";

/** Le témoin : « un choix explicite est à l'essai, l'affichage n'a pas encore eu lieu ». */
export const WITNESS_FILE = "session-essai.json";

/**
 * Les deux fichiers du filet de XWayland-auto (`graphicsSession.ts` →
 * `xwaylandAuto`) : un choix NON explicite, mais qui peut ne rien afficher
 * comme `x11` (le XWayland refusé par SELinux du 27.08). Le témoin d'essai
 * vit le temps d'un lancement ; s'il survit, ou si le GPU meurt trois fois,
 * le marqueur de blocage le remplace et `auto` retombe sur Wayland pour de bon.
 */
export const XWAYLAND_AUTO_TRIAL = "xwayland-auto-essai.json";
export const XWAYLAND_AUTO_OFF = "xwayland-auto-bloque.json";

/**
 * XWayland-auto a-t-il déjà échoué sur ce poste ? Solde aussi un essai resté en
 * plan — sauf `inheritedTrial` : le processus est la relance qui l'a posé
 * pour lui (`session.ts`), l'essai commence à peine.
 */
export function xwaylandAutoBlocked(folder: string, inheritedTrial = false): boolean {
  const trial = path.join(folder, XWAYLAND_AUTO_TRIAL);
  if (!inheritedTrial && existsSync(trial)) {
    blockXwaylandAuto(folder, "le lancement précédent n'a jamais affiché de fenêtre");
    rmSync(trial, { force: true });
  }
  return existsSync(path.join(folder, XWAYLAND_AUTO_OFF));
}

/**
 * Écrit un fichier du secours, en créant le dossier de données au besoin.
 *
 * ⚠️ Au PREMIER lancement, ce dossier n'existe pas encore : c'est Chromium qui
 * le crée, une fois sa plateforme initialisée. Un XWayland injoignable tue le
 * processus avant — mesuré sous GNOME headless : l'essai ne s'écrivait jamais,
 * aucun lancement n'allait plus loin, et l'application ne s'ouvrait plus.
 */
function writeRescueFile(folder: string, name: string, content: string): void {
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, name), content, "utf8");
}

function blockXwaylandAuto(folder: string, reason: string): void {
  console.error(`[session] ⚠️ XWayland en auto : ${reason} — retour à Wayland`);
  try {
    writeRescueFile(
      folder,
      XWAYLAND_AUTO_OFF,
      `${JSON.stringify({ raison: reason, depuis: new Date().toISOString() }, null, 2)}\n`,
    );
  } catch {
    // Sans marqueur, l'essai se rejouera : un clignotement de plus, pas un écran noir.
  }
}

/** Pose le témoin d'essai de XWayland-auto — effacé par `sessionShown()`. */
export function writeXwaylandAutoTrial(folder: string): void {
  trialFolder = folder;
  try {
    writeRescueFile(folder, XWAYLAND_AUTO_TRIAL, "{}\n");
  } catch {
    // Le filet n° 2 manque, la surveillance du GPU reste.
  }
}

let trialFolder: string | null = null;

/** Nombre de morts du processus GPU avant de conclure que ce montage n'affichera pas. */
const FATAL_GPU_DEATHS = 3;

let witnessFolder: string | null = null;

/** Le choix consigné dans le témoin, ou `null` (absent, illisible, farfelu). */
export function readWitness(folder: string): SessionChoice | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(path.join(folder, WITNESS_FILE), "utf8"));
    const v = typeof raw === "object" && raw !== null ? (raw as { choix?: unknown }).choix : null;
    return v === "wayland" || v === "x11" ? v : null;
  } catch {
    return null;
  }
}

/** Pose le témoin — et retient le dossier pour `sessionShown()`. */
export function writeWitness(folder: string, choice: SessionChoice): void {
  witnessFolder = folder;
  try {
    writeRescueFile(
      folder,
      WITNESS_FILE,
      `${JSON.stringify({ choix: choice, depuis: new Date().toISOString() }, null, 2)}\n`,
    );
  } catch {
    // Un témoin qui ne s'écrit pas prive du filet n° 2, pas du lancement.
  }
}

export function clearWitness(folder: string): void {
  try {
    rmSync(path.join(folder, WITNESS_FILE), { force: true });
  } catch {
    // Rien à effacer, ou rien à pouvoir faire — dans les deux cas on continue.
  }
}

/**
 * La fenêtre principale vient de PROUVER qu'elle s'affiche : l'essai du choix
 * explicite est concluant. Sans effet si aucun témoin n'est posé (choix auto,
 * autre plateforme).
 */
export function sessionShown(): void {
  if (witnessFolder !== null) clearWitness(witnessFolder);
  if (trialFolder !== null) rmSync(path.join(trialFolder, XWAYLAND_AUTO_TRIAL), { force: true });
}

/**
 * À appeler AVANT de lire le choix : si le témoin du lancement précédent est
 * encore là pour le MÊME choix, ce choix n'a jamais affiché — on le réécrit en
 * `auto`. Rend le choix condamné, ou `null` si rien n'était à redresser.
 * Un témoin d'un AUTRE choix (l'utilisateur a changé entre-temps) est
 * simplement effacé : le nouveau choix a droit à son propre essai.
 */
export function recoverDoomedChoice(folder: string, requestedChoice: SessionChoice): SessionChoice | null {
  const witness = readWitness(folder);
  if (witness === null) return null;
  clearWitness(folder);
  if (witness !== requestedChoice || requestedChoice === "auto") return null;
  writeFileSync(
    path.join(folder, SESSION_FILE),
    `${JSON.stringify({ session: "auto" }, null, 2)}\n`,
    "utf8",
  );
  return witness;
}

/** Le strict nécessaire d'`app` — et ce qu'un test sait imiter. */
export interface WatchableApp {
  on(event: "child-process-gone", listener: (e: unknown, details: { type: string; reason: string }) => void): unknown;
  relaunch(): void;
  exit(code?: number): void;
}

/**
 * Filet n° 1 : trois morts violentes du processus GPU sous un choix explicite,
 * et l'application réécrit `auto` puis SE RELANCE. Après la relance le choix
 * n'est plus explicite : la surveillance ne peut pas boucler.
 */
export function watchGpu(folder: string, application: WatchableApp): void {
  let dead = 0;
  let rescued = false;
  application.on("child-process-gone", (_e, details) => {
    if (rescued || details.type !== "GPU") return;
    if (details.reason !== "crashed" && details.reason !== "abnormal-exit" && details.reason !== "launch-failed") return;
    dead += 1;
    if (dead < FATAL_GPU_DEATHS) return;
    rescued = true;
    console.error(
      `[session] ⚠️ ${dead} morts du processus GPU : ce montage n'affichera pas — retour en auto et relance`,
    );
    writeFileSync(
      path.join(folder, SESSION_FILE),
      `${JSON.stringify({ session: "auto" }, null, 2)}\n`,
      "utf8",
    );
    clearWitness(folder);
    if (trialFolder === folder) {
      blockXwaylandAuto(folder, `${dead} morts du processus GPU`);
      rmSync(path.join(folder, XWAYLAND_AUTO_TRIAL), { force: true });
    }
    application.relaunch();
    application.exit(0);
  });
}
