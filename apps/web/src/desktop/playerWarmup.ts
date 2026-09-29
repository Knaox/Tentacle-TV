/**
 * Le préchauffage du lecteur natif — Linux, montage collé.
 *
 * Sous Linux, la première seconde d'une lecture était celle de mpv qui montait
 * sa sortie vidéo : ~0,5 s de périphérique Vulkan sur NVIDIA, puis l'interop
 * CUDA. La coquille sait la payer d'avance — une instance « mince », née sans
 * fichier et garée sous notre fenêtre — à une condition : recevoir les MÊMES
 * options que celles que le lecteur donnera ensuite à `mpv_init`. Sinon elle
 * ne la reprendrait pas (voir `apps/desktop-electron/src/main/ipc/videoPrewarm.ts`).
 *
 * La page l'envoie donc elle-même, une fois connectée et au repos. Tout le
 * reste — batterie, montage, instance déjà là, recyclage après une lecture —
 * est décidé par la coquille ; ici on ne fait que demander, sans jamais
 * attendre ni échouer : un préchauffage manqué ne coûte que l'attente d'avant.
 */

import { isFallbackActive } from "../lib/fallbackPlayer";
import { mpvDisabledByDebug } from "../lib/nativePlayer";
import { desktopPlatform, invoke, supportsMpv } from "./bridge";

/** Une demande suffit : la coquille garde l'instance, et se souvient des options. */
const MIN_INTERVAL_MS = 30_000;
let lastAsked = 0;

/** Les cas où le lecteur ouvert ensuite serait bien mpv (voir `pages/Watch.tsx`). */
export function playerWarmupWanted(): boolean {
  return desktopPlatform() === "linux" && supportsMpv() && !isFallbackActive() && !mpvDisabledByDebug();
}

/** Demande à la coquille une instance mpv prête d'avance. Sans effet ailleurs. */
export function warmUpPlayer(now: number = Date.now()): void {
  if (!playerWarmupWanted() || now - lastAsked < MIN_INTERVAL_MS) return;
  lastAsked = now;
  void (async () => {
    // Chargé à la demande : le lecteur vit dans le morceau de la page de lecture.
    const { buildMpvInitOptions, OBSERVED_PROPERTIES } = await import("../hooks/mpvRuntime");
    await invoke("mpv_prewarm", {
      options: { initialOptions: buildMpvInitOptions(), observedProperties: OBSERVED_PROPERTIES },
    });
  })().catch(() => {
    // Rien à dire à l'utilisateur : la lecture partira comme avant.
  });
}
