/**
 * Le branchement de `sessionGraphique.ts` sur Electron.
 *
 * Séparé pour que la décision, elle, reste une fonction pure vérifiable sans
 * Electron. Ici, uniquement le geste : poser le drapeau, retenir le verdict,
 * l'écrire dans le journal.
 */

import { app } from "electron";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  deciderSession,
  FICHIER_SESSION,
  lireChoixSession,
  type ChoixSession,
  type Montage,
  type SessionDecidee,
} from "./sessionGraphique";
import { poserTemoin, redresserChoixCondamne, surveillerGpu } from "./sessionRescue";

let decidee: SessionDecidee | null = null;

/**
 * Décide de la plateforme d'affichage et la pose. À appeler AVANT `whenReady` :
 * Electron initialise Ozone à ce moment-là, et un drapeau posé après n'a plus
 * aucun effet.
 */
export function appliquerSessionGraphique(): SessionDecidee | null {
  if (process.platform !== "linux") return null;
  const dossier = app.getPath("userData");
  // `TENTACLE_LINUX_SESSION` est l'outil d'essai des développeurs : il ne
  // touche pas au réglage, le garde-fou ne doit ni le juger ni le corriger.
  const essaiDev = process.env["TENTACLE_LINUX_SESSION"] !== undefined;
  if (!essaiDev) {
    const condamne = redresserChoixCondamne(dossier, lireChoixSession(dossier));
    if (condamne !== null) {
      console.error(
        `[session] ⚠️ le choix « ${condamne} » n'a jamais affiché de fenêtre au lancement précédent — retour en auto`,
      );
    }
  }
  decidee = deciderSession(process.env, lireChoixSession(dossier));
  if (decidee.ozone !== null) app.commandLine.appendSwitch("ozone-platform", decidee.ozone);
  console.info(
    `[session] bureau=${decidee.session} choix=${decidee.choix} ` +
      `ozone=${decidee.ozone ?? "auto"} montage=${decidee.montage}` +
      (decidee.montage === "wayland" ? " (HDR possible, lecture plein écran)" : " (pas de HDR)"),
  );
  // Un choix explicite peut ne JAMAIS afficher — réglage persistant, fenêtre
  // introuvable, application briquée (vécu avec x11 sur XWayland cassé). Le
  // témoin et la surveillance GPU sont les deux filets ; voir `sessionRescue.ts`.
  if (!essaiDev && decidee.choix !== "auto") {
    poserTemoin(dossier, decidee.choix);
    surveillerGpu(dossier, app);
  }
  return decidee;
}

/**
 * Le montage vidéo en vigueur. `null` hors Linux.
 *
 * ⚠️ Il décrit ce qu'on a DEMANDÉ. En `auto`, Electron peut encore se rabattre
 * sur X11 si la connexion Wayland échoue ; c'est la surface vidéo qui recoupe,
 * au moment où elle tient une vraie fenêtre.
 */
export function montageLinux(): Montage | null {
  return decidee?.montage ?? null;
}

/** Le verdict complet, pour le panneau de diagnostic. */
export function sessionCourante(): SessionDecidee | null {
  return decidee;
}

/**
 * Enregistre un nouveau choix. Il ne prend effet qu'au prochain lancement — la
 * plateforme d'affichage se fixe au démarrage du processus et ne se change pas
 * à chaud. C'est l'appelant qui décide de relancer.
 */
export function enregistrerChoixSession(choix: ChoixSession): void {
  writeFileSync(
    path.join(app.getPath("userData"), FICHIER_SESSION),
    `${JSON.stringify({ session: choix }, null, 2)}\n`,
    "utf8",
  );
}
