/**
 * Octave (mobile) — l'horloge du JavaScript vivante pendant l'écoute, application derrière (Android).
 *
 * Le titre suivant, l'enchaînement et le fondu sont joués par le natif, mais la FILE est en JS : c'est lui qui
 * résout la source du suivant (`fetch`, dont la réponse arrive par un `setTimeout`) et la donne au moteur.
 * Android gèle les minuteurs de React Native dès que l'activité passe en pause : la source n'arrivait jamais,
 * la file s'arrêtait après le titre en cours (vu à l'émulateur le 28/10). Tant que l'on veut écouter, la tâche
 * « headless » des transferts (`androidKeepAlive.ts`) garde l'horloge en marche, au nom de la musique. Rien sur iOS
 * (la session audio d'arrière-plan garde le JavaScript vivant) ni sur le web.
 */

import type { OctavePlayer } from "@tentacle-tv/shared/octave";
import { holdJsAlive, releaseJsAlive } from "@/offline/androidKeepAlive";

const HOLDER = "music";

/** Tient l'horloge tant que le lecteur veut jouer ; rend le détachement. */
export function keepJsAliveWhilePlaying(player: OctavePlayer): () => void {
  let held = false;
  const sync = () => {
    const wants = player.snapshot.get().wantsPlay;
    if (wants === held) return;
    held = wants;
    if (wants) holdJsAlive(HOLDER);
    else releaseJsAlive(HOLDER);
  };
  sync();
  const off = player.snapshot.subscribe(sync);
  return () => {
    off();
    if (held) releaseJsAlive(HOLDER);
  };
}
