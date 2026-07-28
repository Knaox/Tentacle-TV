/**
 * La surface vidéo, vue depuis les commandes : quatre gestes, deux systèmes.
 *
 * # Pourquoi une façade
 *
 * `videoWindow.ts` est du Win32 pur — il cherche une fenêtre enfant par sa
 * classe, la cale au pixel physique près et lui retire ses entrées. Rien de tout
 * cela n'a de sens sur macOS, où mpv ne crée pas de fenêtre mais une *vue* dans
 * la nôtre. Le point commun est le CYCLE DE VIE, pas le mécanisme : on s'attache
 * à une lecture, on suit la géométrie, on se détache.
 *
 * C'est donc le seul endroit de la couche vidéo qui connaît `process.platform`.
 * Les commandes (`ipc/video.ts`) ne le savent plus.
 *
 * ⚠️ Le chargement est PARESSEUX, et ce n'est pas un raffinement : `win32.ts`
 * appelle `koffi.load("user32.dll")` à l'import. Un `import` en tête de fichier
 * ferait tomber le processus principal sur macOS avant la première fenêtre.
 */

import type { BrowserWindow } from "electron";

/**
 * Ce qu'une surface vidéo doit savoir faire, quel que soit le système.
 *
 * `harden` rend `false` quand il n'y a rien à désarmer — soit que la fenêtre de
 * mpv ne soit pas encore née (Windows), soit que la notion n'existe pas (macOS).
 * La page traite déjà ce cas : la commande est un rappel, pas une garantie.
 */
export interface VideoSurface {
  attach(): void;
  align(): void;
  harden(): boolean;
  detach(): void;
  /**
   * La fenêtre vidéo a-t-elle disparu ?
   *
   * Facultatif : seule une plateforme dont l'arrêt doit ATTENDRE le démontage
   * de la sortie vidéo en a besoin — macOS, où demander `quit` trop tôt fige le
   * thread principal. Windows détruit d'un bloc et n'a rien à guetter.
   */
  videoDisparue?(): boolean;
}

/**
 * Surface qui ne fait rien, pour les systèmes sans embarquement.
 *
 * Elle existe pour que l'application DÉMARRE et se diagnostique là où la vidéo
 * n'est pas prête, plutôt que de tomber à la première commande. Le panneau de
 * diagnostic reste donc lisible sur un système en cours de portage — c'est
 * précisément là qu'on en a le plus besoin. Linux tient encore sur Tauri ; le
 * jour où il passera ici, c'est cette classe qu'il remplacera.
 */
class SurfaceInerte implements VideoSurface {
  attach(): void {}
  align(): void {}
  harden(): boolean {
    return false;
  }
  detach(): void {}
}

/** La surface adaptée au système, pour la fenêtre donnée. */
export function creerSurfaceVideo(host: BrowserWindow): VideoSurface {
  if (process.platform === "win32") {
    const { VideoWindow } = require("./videoWindow") as typeof import("./videoWindow");
    return new VideoWindow(host);
  }
  if (process.platform === "darwin") {
    const { MacosSurface } = require("./macosSurface") as typeof import("./macosSurface");
    return new MacosSurface(host);
  }
  return new SurfaceInerte();
}
