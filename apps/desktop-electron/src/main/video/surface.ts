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
  /**
   * La fenêtre native qui porte la vidéo, quand il y en a une.
   *
   * Sert à interroger le BON écran : sur un poste à plusieurs moniteurs, la
   * plage étendue accordée n'est pas la même sur un XDR et sur un écran SDR, et
   * c'est celui qui affiche la vidéo qui compte.
   */
  fenetreVideo?(): unknown;
  /**
   * Numéro de la fenêtre vidéo, ou `0` tant qu'elle n'existe pas.
   *
   * C'est par lui que la sonde CAPTURE l'image — la seule preuve qui vaille
   * qu'on affiche quelque chose (voir `macosCapture.ts`).
   */
  numeroFenetre?(): number;
  /** L'état géométrique des deux fenêtres, en une ligne lisible. */
  geometrie?(): string;
  /**
   * Ce qu'il faut défaire AVANT que mpv ne s'arrête.
   *
   * Facultatif, et seule la Render API en a besoin : le contexte de rendu doit
   * être libéré pendant que mpv est encore debout, faute de quoi les deux
   * s'attendent — `mpv_render_context_free` attend la fin du rendu en cours, et
   * mpv démonte sa sortie vidéo à l'arrêt.
   */
  prearret?(): void;
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

/**
 * Le montage vidéo retenu sur macOS.
 *
 * Deux existent, et ils ne se valent pas de la même façon :
 *
 *  - `gl` (défaut) — Render API dans une vue à nous. UNE fenêtre : ni calage
 *    manuel, ni ordre d'empilement à réaffirmer, ni liseré transparent. La
 *    plage étendue vient de `wantsExtendedDynamicRangeOpenGLSurface`, sans les
 *    métadonnées de mastering, réservées à Metal ;
 *  - `fenetre` — la fenêtre de mpv calée sous la nôtre. Couche Metal, donc PQ
 *    transmis tel quel et `edrMetadata` — le meilleur HDR possible —, au prix
 *    des trois défauts ci-dessus.
 *
 * `TENTACLE_VIDEO_MONTAGE` permet de passer de l'un à l'autre sans rebâtir, le
 * temps de les comparer sur les mêmes images.
 */
function montageMacos(): "gl" | "fenetre" {
  return process.env["TENTACLE_VIDEO_MONTAGE"] === "fenetre" ? "fenetre" : "gl";
}

/** La surface adaptée au système, pour la fenêtre donnée. */
export function creerSurfaceVideo(host: BrowserWindow): VideoSurface {
  if (process.platform === "win32") {
    const { VideoWindow } = require("./videoWindow") as typeof import("./videoWindow");
    return new VideoWindow(host);
  }
  if (process.platform === "darwin") {
    if (montageMacos() === "fenetre") {
      const { MacosSurface } = require("./macosSurface") as typeof import("./macosSurface");
      return new MacosSurface(host);
    }
    const { MacosSurfaceGl } = require("./macosSurfaceGl") as typeof import("./macosSurfaceGl");
    return new MacosSurfaceGl(host);
  }
  return new SurfaceInerte();
}

/** Le montage en vigueur, pour le journal et le diagnostic. */
export function montageVideo(): string {
  if (process.platform !== "darwin") return process.platform;
  return montageMacos();
}
