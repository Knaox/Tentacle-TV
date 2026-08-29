/**
 * Les TRACES de la colle KWin : ses dossiers, son nom de greffon, sa reprise.
 *
 * Deux choses survivent à une pose de colle (`kwinGlue.ts`), et aucune ne se
 * nettoie toute seule :
 *
 * - le DOSSIER du QML, dans le répertoire temporaire — un par pose, parce que
 *   le moteur QML de KWin est aveugle aux fichiers apparus dans un dossier
 *   qu'il a déjà servi (voir l'en-tête de `kwinGlue.ts`) ;
 * - l'INSTANCE dans le compositeur : un script KWin survit au processus qui
 *   l'a chargé. Une application tuée en pleine lecture laisse la sienne vivante
 *   jusqu'au redémarrage du compositeur — relevé sur pièce, deux fantômes sur
 *   `/Scripting` sans aucune instance de l'application.
 *
 * D'où le nom de greffon PAR PID : il porte à la fois la prise pour décrocher
 * (`unloadScript`) et la preuve de mort (le pid ne répond plus). On ne
 * touche jamais à la colle d'un pid vivant — une instance de développement et
 * une instance installée peuvent tourner côte à côte.
 */

import { readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { unloadScript, unloadScriptSync } from "./kwinScripting";

/** Le dossier de la n-ième pose de ce processus. Exporté pour les tests. */
export function glueFolder(pid: number, number: number): string {
  return path.join(tmpdir(), `tentacle-colle-${String(pid)}-${String(number)}`);
}

export function removeFolder(folder: string): void {
  try {
    rmSync(folder, { recursive: true, force: true });
  } catch {
    /* déjà absent, ou /tmp balayé sous nos pieds */
  }
}

/**
 * Le nom de greffon de CE processus — la seule prise pour décrocher une colle.
 *
 * Par pid, jamais fixe : une instance de développement ne doit pas décrocher
 * la colle d'une instance installée qui tourne en même temps.
 */
export function pluginName(pid: number): string {
  return `tentacle-colle-${String(pid)}`;
}

const FOLDER_PATTERN = /^tentacle-colle-(\d+)-\d+$/;

/**
 * Les dossiers de pose d'une racine, avec leur pid.
 *
 * La racine est un paramètre pour que les tests ne balaient pas le répertoire
 * temporaire de la machine qui les fait tourner.
 */
function glueFolders(root: string): { name: string; pid: number }[] {
  try {
    return readdirSync(root).flatMap((name) => {
      const pid = Number(FOLDER_PATTERN.exec(name)?.[1] ?? Number.NaN);
      return Number.isInteger(pid) && pid > 0 ? [{ name, pid }] : [];
    });
  } catch {
    return [];
  }
}

/** Le processus tourne-t-il encore ? `EPERM` = vivant, mais à quelqu'un d'autre. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Ce qu'un lancement MORT a laissé dans le compositeur : décroché, effacé.
 *
 * Un script KWin survit au processus qui l'a posé — une application tuée en
 * pleine lecture laisse son instance QML vivante jusqu'au redémarrage du
 * compositeur (relevé : deux fantômes sur `/Scripting` sans aucune instance de
 * l'application). Chaque lancement reprend donc ce que les morts ont laissé,
 * en n'y touchant QUE si leur pid ne répond plus.
 */
export async function sweepOrphanGlue(root: string = tmpdir()): Promise<number> {
  const dead = new Set<number>();
  for (const { name, pid } of glueFolders(root)) {
    if (pid === process.pid || alive(pid)) continue;
    dead.add(pid);
    removeFolder(path.join(root, name));
  }
  // L'ancien montage — un dossier unique partagé, un fichier par pose — n'est
  // plus écrit par personne : ce qui y traîne est mort par construction. Ses
  // greffons, eux, étaient anonymes : rien ne peut plus les décrocher, ils
  // partiront avec le compositeur.
  removeFolder(path.join(root, "tentacle-colle"));
  for (const pid of dead) await unloadScript(pluginName(pid));
  if (dead.size > 0) {
    console.info(
      `[video] colle : ${String(dead.size)} greffon(s) d'un lancement mort décroché(s)`,
    );
  }
  return dead.size;
}

/**
 * Notre propre colle, retirée au DÉPART de l'application — synchrone.
 *
 * `will-quit` ne rend pas la main à la boucle d'événements : une promesse n'y
 * serait jamais tenue. Sans ce geste, quitter en pleine lecture laisse un
 * fantôme de plus dans le compositeur jusqu'au balayage suivant.
 */
export function removeGlueAtStartup(root: string = tmpdir()): void {
  unloadScriptSync(pluginName(process.pid));
  for (const { name, pid } of glueFolders(root)) {
    if (pid === process.pid) removeFolder(path.join(root, name));
  }
}
