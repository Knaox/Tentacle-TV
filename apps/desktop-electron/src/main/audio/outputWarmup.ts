/**
 * Préchauffer la sortie audio dès la naissance de l'instance, pour que le
 * PREMIER clic ne paie pas l'initialisation de CoreAudio.
 *
 * # Le palier de ~2 s, mesuré
 *
 * Au premier `AudioUnitInitialize` d'un processus, macOS recense les composants
 * audio du système (`AudioComponentRegistrar`) : journal de mpv, clic à froid
 * sur ce Mac, 1,72 s entre « audio channel layout » et « Latency property » —
 * le réseau et le décodage étaient prêts en 50 ms. Cache système chaud : 17 ms.
 * Le cache retombe de lui-même (un clic sur plusieurs, à des moments
 * imprévisibles : 1 890 ms, 1 947 ms relevés), et les composants tiers (pilotes
 * HAL, plugins Audio Unit) l'allongent.
 *
 * # Le remède
 *
 * 50 ms de silence NUMÉRIQUE (`anullsrc`), sourdine en plus, joués par la vraie
 * sortie à la naissance de l'instance : le recensement se fait là, pendant que
 * l'interface se monte. L'entrée ne garde pas la sortie ouverte (`keep-open=no` :
 * la liste se vide, mpv ferme la sortie — jamais un périphérique tenu, mode
 * exclusif compris). Un clic pendant le préchauffage le remplace simplement.
 */

import { formatFileOptions } from "./audioOptions";

export const WARMUP_URL = "av://lavfi:anullsrc=r=48000:cl=stereo";

export function warmupArgs(): string[] {
  return ["loadfile", WARMUP_URL, "replace", "-1", formatFileOptions({ end: "0.05", mute: "yes", "keep-open": "no" })];
}

/**
 * Lance le préchauffage. Rend l'identifiant d'entrée mpv qu'il occupe (le moteur
 * l'ignore à son départ) ; un refus de mpv le rend au modèle (`loadFailed`).
 */
export function warmOutput(
  mpv: { command: (args: readonly string[]) => Promise<string | null> },
  queue: { reserveId: () => number; loadFailed: (mpvId: number) => void },
): number {
  const id = queue.reserveId();
  void mpv.command(warmupArgs()).then((error) => {
    if (error === null) return;
    queue.loadFailed(id);
    console.warn(`[audio] préchauffage de la sortie refusé : ${error}`);
  });
  return id;
}
