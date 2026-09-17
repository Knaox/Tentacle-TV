/**
 * Le cycle de vie de l'instance mpv, vu des commandes : la surface vidéo
 * courante, l'arrêt par la porte que la plateforme supporte, et le parking
 * entre deux épisodes.
 *
 * Extrait de `ipc/video.ts` pour tenir la limite de 300 lignes, et parce que
 * décider quand mpv meurt est un métier distinct d'exposer des commandes.
 *
 * # L'arrêt — par la porte de la plateforme
 *
 * ⚠️ macOS ne peut PAS détruire d'un bloc : `mpv_terminate_destroy` y attend le
 * démontage de la sortie vidéo, lequel réclame le thread principal — celui qui
 * appelle. Linux le PEUT, mais au prix d'une seconde de gel : l'appel est un
 * FFI synchrone qui joint démuxeur, décodage et contexte Vulkan, et la fenêtre
 * de mpv — de premier niveau chez nous, jamais enfant — n'est démontée qu'en
 * dernier : elle restait seule à l'écran tout ce temps. Les deux prennent donc
 * l'arrêt gracieux (voir `mpvShutdown.ts`) : la vidéo d'abord, sans bloquer.
 * Sous Linux le témoin est l'évènement `idle` de mpv, émis une fois la sortie
 * vidéo — et sa fenêtre — détruite : `quit` part aussitôt, là où dix tours
 * de 50 ms l'attendaient. Windows détruit comme il l'a toujours fait
 * (fenêtre enfant Win32, aucun couplage, en production).
 *
 * L'ORDRE compte : mpv s'arrête AVANT le détachement. L'inverse rendrait la
 * fenêtre de mpv indépendante le temps de sa mort, donc visible seule à
 * l'écran — et `SurfaceWayland.detach` sort du plein écran, ce qui ne doit
 * arriver qu'une fois la vidéo partie.
 *
 * `stopPlayer` a un second appelant : la séquence de fermeture
 * (`closeSequence.ts`) s'en sert sous Linux, où la fenêtre de mpv survivrait
 * sinon à la nôtre.
 *
 * # Le parking — `mpvPark.ts` dit pourquoi, ici le comment
 *
 * `mpv_destroy` ne détruit plus, là où l'on peut garer : `force-window=yes`
 * puis `stop`, et mpv retombe à l'idle en gardant sa sortie vidéo — VkDevice,
 * décodeur, fenêtre collée. Un `mpv_init` qui suit dans le délai avec les
 * mêmes options la reprend telle quelle ; la page, elle, ne voit rien d'autre
 * qu'un `mpv_init` très rapide.
 */

import { linuxMontage, linuxWindowing } from "../linux/session";
import { command, destroy, isRunning, reobserve } from "../video/mpv";
import type { MpvValue } from "../video/mpvAllowlist";
import { Park, optionsSignature } from "../video/mpvPark";
import { stop } from "../video/mpvShutdown";
import { beginShutdown, endShutdown, markStartup } from "../video/startupClock";
import type { VideoSurface } from "../video/surface";

type Observed = ReadonlyArray<readonly [string, string]>;

let video: VideoSurface | null = null;

export function currentSurface(): VideoSurface | null {
  return video;
}

/** Pose la surface de la lecture qui commence ; la précédente est détachée. */
export function adoptSurface(surface: VideoSurface): void {
  video?.detach();
  video = surface;
}

/** Ce avec quoi l'instance vivante a été créée — la signature du parking. */
let liveSignature: string | null = null;

export function rememberInit(options: Readonly<Record<string, MpvValue>>, observed: Observed): void {
  liveSignature = optionsSignature(options, observed);
}

const park = new Park(() => {
  console.info("[mpv] instance gardée au chaud : délai écoulé, arrêt");
  void stopPlayer();
});

/**
 * Le parking n'existe que là où la fenêtre garée est GARANTIE sous la nôtre :
 * Wayland + colle KWin. Voir `mpvPark.ts` pour ce que les autres montages
 * risqueraient.
 */
export function parkable(): boolean {
  return process.platform === "linux" && linuxMontage() === "wayland" && linuxWindowing() === "libre";
}

/** Arrête le lecteur, par le chemin que la plateforme supporte. */
export async function stopPlayer(): Promise<void> {
  park.cancel();
  const surface = video;
  video = null;
  liveSignature = null;
  // ⚠️ AVANT l'arrêt, et seule la Render API s'en sert : son contexte de rendu
  // doit être libéré pendant que mpv est encore debout. L'inverse fait
  // s'attendre les deux — `mpv_render_context_free` attend la fin du rendu en
  // cours, et mpv démonte sa sortie vidéo à l'arrêt.
  surface?.preStop?.();
  if (process.platform !== "win32") {
    const witness = surface?.videoGone?.bind(surface);
    await stop(witness);
  } else {
    destroy();
  }
  surface?.detach();
}

/**
 * `mpv_destroy` : garer si l'on peut, arrêter sinon. La surface reste
 * attachée à une instance garée — sa fenêtre est toujours là, collée.
 */
export async function releasePlayer(): Promise<void> {
  beginShutdown();
  if (parkable() && isRunning() && liveSignature !== null) {
    // `force-window=yes` AVANT `stop` : c'est à l'idle que mpv décide de garder
    // ou non sa sortie vidéo (`player/playloop.c`, `idle_loop`).
    void command(["set", "force-window", "yes"]);
    void command(["stop"]);
    park.park(liveSignature);
    console.info("[mpv] instance gardée au chaud — reprise si une lecture suit dans les 3 s");
  } else {
    await stopPlayer();
  }
  endShutdown();
}

/**
 * `mpv_init` : reprend l'instance garée si ses options sont celles demandées.
 * Les propriétés sont ré-observées pour que la page reçoive leurs valeurs
 * initiales, comme d'une instance neuve.
 */
export function reuseParked(options: Readonly<Record<string, MpvValue>>, observed: Observed): boolean {
  if (!isRunning() || !park.reuse(optionsSignature(options, observed))) return false;
  reobserve(observed);
  markStartup("reused");
  return true;
}
