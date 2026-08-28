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
 * (`dechargerScript`) et la preuve de mort (le pid ne répond plus). On ne
 * touche jamais à la colle d'un pid vivant — une instance de développement et
 * une instance installée peuvent tourner côte à côte.
 */

import { readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { dechargerScript, dechargerScriptSync } from "./kwinScripting";

/** Le dossier de la n-ième pose de ce processus. Exporté pour les tests. */
export function dossierPose(pid: number, numero: number): string {
  return path.join(tmpdir(), `tentacle-colle-${String(pid)}-${String(numero)}`);
}

export function effacerDossier(dossier: string): void {
  try {
    rmSync(dossier, { recursive: true, force: true });
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
export function nomGreffon(pid: number): string {
  return `tentacle-colle-${String(pid)}`;
}

const MOTIF_DOSSIER = /^tentacle-colle-(\d+)-\d+$/;

/**
 * Les dossiers de pose d'une racine, avec leur pid.
 *
 * La racine est un paramètre pour que les tests ne balaient pas le répertoire
 * temporaire de la machine qui les fait tourner.
 */
function dossiersDePose(racine: string): { nom: string; pid: number }[] {
  try {
    return readdirSync(racine).flatMap((nom) => {
      const pid = Number(MOTIF_DOSSIER.exec(nom)?.[1] ?? Number.NaN);
      return Number.isInteger(pid) && pid > 0 ? [{ nom, pid }] : [];
    });
  } catch {
    return [];
  }
}

/** Le processus tourne-t-il encore ? `EPERM` = vivant, mais à quelqu'un d'autre. */
function vivant(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erreur) {
    return (erreur as NodeJS.ErrnoException).code === "EPERM";
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
export async function balayerCollesOrphelines(racine: string = tmpdir()): Promise<number> {
  const morts = new Set<number>();
  for (const { nom, pid } of dossiersDePose(racine)) {
    if (pid === process.pid || vivant(pid)) continue;
    morts.add(pid);
    effacerDossier(path.join(racine, nom));
  }
  // L'ancien montage — un dossier unique partagé, un fichier par pose — n'est
  // plus écrit par personne : ce qui y traîne est mort par construction. Ses
  // greffons, eux, étaient anonymes : rien ne peut plus les décrocher, ils
  // partiront avec le compositeur.
  effacerDossier(path.join(racine, "tentacle-colle"));
  for (const pid of morts) await dechargerScript(nomGreffon(pid));
  if (morts.size > 0) {
    console.info(
      `[video] colle : ${String(morts.size)} greffon(s) d'un lancement mort décroché(s)`,
    );
  }
  return morts.size;
}

/**
 * Notre propre colle, retirée au DÉPART de l'application — synchrone.
 *
 * `will-quit` ne rend pas la main à la boucle d'événements : une promesse n'y
 * serait jamais tenue. Sans ce geste, quitter en pleine lecture laisse un
 * fantôme de plus dans le compositeur jusqu'au balayage suivant.
 */
export function retirerColleAuDepart(racine: string = tmpdir()): void {
  dechargerScriptSync(nomGreffon(process.pid));
  for (const { nom, pid } of dossiersDePose(racine)) {
    if (pid === process.pid) effacerDossier(path.join(racine, nom));
  }
}
