/**
 * Le branchement de `graphicsSession.ts` sur Electron.
 *
 * Séparé pour que la décision, elle, reste une fonction pure vérifiable sans
 * Electron. Ici, uniquement le geste : poser le drapeau, retenir le verdict,
 * l'écrire dans le journal.
 */

import { app } from "electron";
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  decideSession,
  SESSION_FILE,
  readSessionChoice,
  type SessionChoice,
  type Montage,
  type DecidedSession,
} from "./graphicsSession";
import { writeWitness, recoverDoomedChoice, watchGpu } from "./sessionRescue";
// Sans risque à l'import (aucune bibliothèque native) — contrairement aux
// surfaces, pas besoin de `require` paresseux.
import { kwinScriptApiAvailable } from "./kwinScripting";
import { sweepOrphanGlue } from "./glueCleanup";

let decided: DecidedSession | null = null;

/**
 * Décide de la plateforme d'affichage et la pose. À appeler AVANT `whenReady` :
 * Electron initialise Ozone à ce moment-là, et un drapeau posé après n'a plus
 * aucun effet.
 */
export function applyGraphicsSession(): DecidedSession | null {
  if (process.platform !== "linux") return null;
  const folder = app.getPath("userData");
  // `TENTACLE_LINUX_SESSION` est l'outil d'essai des développeurs : il ne
  // touche pas au réglage, le garde-fou ne doit ni le juger ni le corriger.
  const devTry = process.env["TENTACLE_LINUX_SESSION"] !== undefined;
  if (!devTry) {
    const doomed = recoverDoomedChoice(folder, readSessionChoice(folder));
    if (doomed !== null) {
      console.error(
        `[session] ⚠️ le choix « ${doomed} » n'a jamais affiché de fenêtre au lancement précédent — retour en auto`,
      );
    }
  }
  decided = decideSession(process.env, readSessionChoice(folder));
  if (decided.ozone !== null) app.commandLine.appendSwitch("ozone-platform", decided.ozone);
  // Budget de tuiles du compositeur Chromium. Le défaut (quelques centaines de
  // Mo) ne tient pas les transitions de pages sur un bureau 4K à échelle ×2 :
  // plusieurs calques plein viewport animés d'un coup → « tile memory limits
  // exceeded, some content may not draw » en rafale, et des morceaux de page
  // qui manquent pendant l'animation (artefacts mesurés le 28.08, journal de
  // l'utilisateur — bibliothèque et fiche média, fenêtré comme maximisé).
  app.commandLine.appendSwitch("force-gpu-mem-available-mb", "2048");
  console.info(
    `[session] bureau=${decided.session} choix=${decided.choice} ` +
      `ozone=${decided.ozone ?? "auto"} montage=${decided.montage}` +
      // Le fenêtré n'est pas encore connu ici — `detecterFenetrage` le dira.
      (decided.montage === "wayland" ? " (HDR possible)" : " (pas de HDR)"),
  );
  // Un choix explicite peut ne JAMAIS afficher — réglage persistant, fenêtre
  // introuvable, application briquée (vécu avec x11 sur XWayland cassé). Le
  // témoin et la surveillance GPU sont les deux filets ; voir `sessionRescue.ts`.
  if (!devTry && decided.choice !== "auto") {
    writeWitness(folder, decided.choice);
    watchGpu(folder, app);
  }
  return decided;
}

/**
 * Le montage vidéo en vigueur. `null` hors Linux.
 *
 * ⚠️ Il décrit ce qu'on a DEMANDÉ. En `auto`, Electron peut encore se rabattre
 * sur X11 si la connexion Wayland échoue ; c'est la surface vidéo qui recoupe,
 * au moment où elle tient une vraie fenêtre.
 */
export function linuxMontage(): Montage | null {
  return decided?.montage ?? null;
}

let windowing: "libre" | "plein-ecran" | null = null;

/**
 * Le fenêtré est-il possible sous Wayland ? Décidé UNE fois, avant la fenêtre.
 *
 * `libre` = le compositeur offre une API de placement (la colle KWin,
 * `kwinGlue.ts`) : la lecture suit la fenêtre, comme sur Windows.
 * `plein-ecran` = pas d'API (GNOME, wlroots…) : le montage plein écran forcé
 * de `surfaceWayland.ts` reste le seul possible. `null` hors Wayland — sous
 * X11 le fenêtré est natif, la question ne se pose pas.
 */
export async function detectWindowing(): Promise<void> {
  if (process.platform !== "linux" || decided?.montage !== "wayland") {
    windowing = null;
    return;
  }
  windowing = (await kwinScriptApiAvailable()) ? "libre" : "plein-ecran";
  // Ce qu'un lancement mort a laissé dans le compositeur se reprend ici, une
  // fois qu'on sait qu'il y a un compositeur scriptable. Sans attendre : le
  // démarrage de la fenêtre ne dépend pas du ménage.
  if (windowing === "libre") void sweepOrphanGlue();
  console.info(
    windowing === "libre"
      ? "[session] fenêtré libre : l'API de script du compositeur porte la colle KWin"
      : "[session] plein écran forcé : compositeur sans API de placement (pas de colle)",
  );
}

/** Le verdict de `detecterFenetrage`, pour la surface, la page et le panneau. */
export function linuxWindowing(): "libre" | "plein-ecran" | null {
  return windowing;
}

/** Le verdict complet, pour le panneau de diagnostic. */
export function currentSession(): DecidedSession | null {
  return decided;
}

/**
 * Enregistre un nouveau choix. Il ne prend effet qu'au prochain lancement — la
 * plateforme d'affichage se fixe au démarrage du processus et ne se change pas
 * à chaud. C'est l'appelant qui décide de relancer.
 */
export function saveSessionChoice(choice: SessionChoice): void {
  writeFileSync(
    path.join(app.getPath("userData"), SESSION_FILE),
    `${JSON.stringify({ session: choice }, null, 2)}\n`,
    "utf8",
  );
}
