/**
 * Octave — un ÉTAT DE LISIBILITÉ appris après coup (lot « ol ») : le sondage `playability` de l'extension, ou un
 * refus de `resolve` au moment de lire. Il est posé SUR PLACE : la file (`refusedQueue`), et chaque liste affichée
 * (l'application s'abonne : `onPlayabilityLearned`, et patche son cache de requêtes par clé). La ligne ne bouge pas,
 * seul son habit change (`trackPlayability`).
 */

import type { MusicPlayable, MusicPlayableReason } from "../music";
import { replaceTracks, type QueueState } from "./queueModel";
import { withPlayability } from "./trackPlayability";

export interface PlayabilityPatch {
  playable: MusicPlayable;
  reason?: MusicPlayableReason | null;
}

type Listener = (states: ReadonlyMap<string, PlayabilityPatch>) => void;
const listeners = new Set<Listener>();

/** Des états appris, par CLÉ de titre (`ext:<pluginId>:<id>`) : chaque application les pose dans ses listes. */
export function announcePlayability(states: ReadonlyMap<string, PlayabilityPatch>): void {
  if (states.size === 0) return;
  for (const listener of [...listeners]) listener(states);
}

export function onPlayabilityLearned(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La file, chaque entrée de ce titre marquée illisible (la file la sautera) ; la même file si rien ne change. */
export function refusedQueue(queue: QueueState, key: string, reason: MusicPlayableReason | null): QueueState {
  return replaceTracks(queue, key, (track) => withPlayability(track, { playable: "no", reason }));
}
