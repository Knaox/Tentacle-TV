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

import { montageLinux } from "../linux/session";

/**
 * Ce qu'une surface vidéo doit savoir faire, quel que soit le système.
 *
 * `harden` rend `false` quand il n'y a rien à désarmer — soit que la fenêtre de
 * mpv ne soit pas encore née (Windows), soit que la notion n'existe pas (macOS).
 * La page traite déjà ce cas : la commande est un rappel, pas une garantie.
 */
export interface VideoSurface {
  /**
   * Asynchrone quand la surface a quelque chose à garantir AVANT que la page
   * n'envoie `loadfile` — Wayland y pose `fs-screen-name`, qui n'est lu qu'à
   * la naissance de la fenêtre mpv. L'appelant attend la promesse.
   */
  attach(): void | Promise<void>;
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
   * mpv vient d'ouvrir un fichier : sa fenêtre naît maintenant, mappée en
   * dernier — donc DEVANT la nôtre là où c'est le compositeur qui empile.
   *
   * Facultatif : seule Wayland en a besoin, pour se re-mapper par-dessus
   * (mesuré, docs/LINUX-FENETRE-VIDEO.md). Les surfaces qui calent au pixel
   * n'ont rien à en faire.
   */
  fichierCharge?(): void;
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
 * précisément là qu'on en a le plus besoin.
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
 * Le montage vidéo retenu sur macOS. Deux existent, et un seul fait du HDR.
 *
 * # `fenetre` — la fenêtre de mpv calée sous la nôtre (DÉFAUT)
 *
 * mpv y dessine sur SA couche Metal. C'est le seul chemin qui donne du vrai
 * HDR sur macOS, et le rendu lui-même l'écrit dans le journal :
 * `Metal layer colorspace changed: ITUR_2100_PQ`, `Metal layer HDR active`,
 * `edrMetadata … max 3999 nits`. Le PQ est transmis tel quel.
 *
 * # `gl` — Render API dans une vue à nous
 *
 * Architecturalement supérieur : une seule fenêtre, donc ni calage manuel, ni
 * ordre d'empilement à réaffirmer, ni liseré transparent. Il a été construit,
 * mesuré, et il ne tient pas — pour deux raisons qui ne se corrigent pas ici :
 *
 * ⚠️ **mpv ne sait pas produire de valeurs au-delà de 1.0.** L'EDR de macOS
 * demande exactement cela : des hautes lumières qui dépassent le blanc SDR.
 * Les deux tentatives amont — mpv#8387, mpv#8485 — ont dû PATCHER les shaders
 * (multiplier par 3.0, retirer le `clamp` à 1.0) faute d'option, et les deux
 * ont été abandonnées sans être fusionnées. Aucune combinaison de `target-trc`,
 * `target-prim` et `target-peak` n'y supplée.
 *
 * ⚠️ **Et la mesure d'EDR y ment.** `wantsExtendedDynamicRangeOpenGLSurface`
 * fait accorder le headroom PAR LE SYSTÈME, à la demande, sans regarder ce
 * qu'on dessine : la sonde rapportait 16,00 sur 16,00 — mieux que les 12,82 du
 * montage Metal — pour une image qui n'avait rien de HDR. C'est exactement le
 * piège que ce projet paie depuis le début : une mesure qui ne mesure pas ce
 * qu'on croit. Le journal de la couche Metal, lui, est écrit par le rendu.
 *
 * Il reste accessible par `TENTACLE_VIDEO_MONTAGE=gl` : le jour où `gpu-next`
 * arrivera dans la Render API (mpv#16818, en draft), c'est par là qu'il faudra
 * repasser.
 */
function montageMacos(): "gl" | "fenetre" {
  return process.env["TENTACLE_VIDEO_MONTAGE"] === "gl" ? "gl" : "fenetre";
}

/** La surface adaptée au système, pour la fenêtre donnée. */
export function creerSurfaceVideo(host: BrowserWindow): VideoSurface {
  if (process.platform === "win32") {
    const { VideoWindow } = require("./videoWindow") as typeof import("./videoWindow");
    return new VideoWindow(host);
  }
  if (process.platform === "linux") {
    // Deux montages, décidés par la session au démarrage (`linux/session.ts`).
    // Wayland : deux fenêtres plein écran, rien à caler, HDR possible.
    // X11     : calage et empilement à la main, comme Windows, sans HDR.
    if (montageLinux() === "wayland") {
      const { SurfaceWayland } = require("../linux/surfaceWayland") as typeof import("../linux/surfaceWayland");
      return new SurfaceWayland(host);
    }
    // ⚠️ `require` et non `import` : `x11.ts` ouvre `libX11.so.6` dès son
    // chargement, comme `win32.ts` avec `user32.dll`.
    const { SurfaceX11 } = require("../linux/surfaceX11") as typeof import("../linux/surfaceX11");
    return new SurfaceX11(host);
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
  if (process.platform === "linux") return `linux/${montageLinux() ?? "inconnu"}`;
  if (process.platform !== "darwin") return process.platform;
  return montageMacos();
}
