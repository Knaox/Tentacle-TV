/**
 * Octave — les contrôles du SYSTÈME (écran verrouillé, Centre de contrôle, notification média, casque, appel)
 * appliqués au lecteur : exactement les gestes de la barre. Le moteur transmet (`EngineEvent` « remote »),
 * l'intention « lecture » et la file restent au lecteur — une pause faite d'office par le système (casque
 * débranché) remet ainsi le bouton sur « Lecture ». « Arrêter » (notification, application balayée) vide la file.
 */

import type { EngineEvent } from "../music";

export type RemoteCommand = Extract<EngineEvent, { type: "remote" }>["command"];

export interface RemoteTarget {
  resume(): void;
  pause(): void;
  next(): void;
  previous(): void;
  /** « Arrêter » : la lecture s'arrête et la file se vide (`OctavePlayer.clear`). */
  clear(): void;
}

export function applyRemoteCommand(player: RemoteTarget, command: RemoteCommand): void {
  if (command === "play") player.resume();
  else if (command === "pause") player.pause();
  else if (command === "next") player.next();
  else if (command === "stop") player.clear();
  else player.previous();
}
