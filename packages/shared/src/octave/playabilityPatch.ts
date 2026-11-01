/**
 * Octave — un ÉTAT DE LISIBILITÉ appris après coup (lot « ol ») : le sondage `playability` de l'extension, ou un
 * refus de `resolve` au moment de lire. Il est gardé PAR CLÉ (`learnedPlayability`, borné) et posé sur place :
 * `isTrackUnavailable` le lit (la file saute un titre appris illisible), chaque rangée s'abonne à SA clé
 * (`onPlayabilityOf` : seule la rangée qui change se redessine, jamais toute la liste). La ligne ne bouge pas,
 * seul son habit change (`trackPlayability`).
 */

import type { MusicPlayable, MusicPlayableReason, MusicTrack } from "../music";
import { replaceTracks, type QueueState } from "./queueModel";
import { withPlayability } from "./trackPlayability";

export interface PlayabilityPatch {
  playable: MusicPlayable;
  reason?: MusicPlayableReason | null;
}

type Listener = (states: ReadonlyMap<string, PlayabilityPatch>) => void;
const listeners = new Set<Listener>();
const keyListeners = new Map<string, Set<() => void>>();

/** Au-delà, les plus anciens sont oubliés (une longue écoute ne fait pas grossir la mémoire). */
export const LEARNED_MAX = 2_000;
const learned = new Map<string, PlayabilityPatch>();

/** Des états appris, par CLÉ de titre (`ext:<pluginId>:<id>`) : gardés, puis dits à qui les écoute. */
export function announcePlayability(states: ReadonlyMap<string, PlayabilityPatch>): void {
  const changed = new Map<string, PlayabilityPatch>();
  for (const [key, patch] of states) {
    // « unknown » n'est pas un état appris (il ne grise ni ne dégrise rien) : rien à garder ni à dire.
    if (patch.playable === "unknown") continue;
    const before = learned.get(key);
    if (before && before.playable === patch.playable && (before.reason ?? null) === (patch.reason ?? null)) continue;
    learned.delete(key);
    learned.set(key, patch);
    changed.set(key, patch);
  }
  while (learned.size > LEARNED_MAX) learned.delete(learned.keys().next().value as string);
  if (changed.size === 0) return;
  for (const listener of [...listeners]) listener(changed);
  for (const key of changed.keys()) for (const l of [...(keyListeners.get(key) ?? [])]) l();
}

export function learnedPlayability(key: string): PlayabilityPatch | null {
  return learned.get(key) ?? null;
}

/** Le titre avec l'état appris posé (le même objet sans rien d'appris, ou rien qui change). */
export function withLearnedPlayability<T extends Pick<MusicTrack, "key" | "jellyfinId" | "unavailable" | "playable" | "playableReason">>(track: T): T {
  const patch = track.jellyfinId ? null : learned.get(track.key);
  return patch ? withPlayability(track, { playable: patch.playable, reason: patch.reason ?? null }) : track;
}

/** Une rangée écoute SA clé seulement. */
export function onPlayabilityOf(key: string, listener: () => void): () => void {
  let set = keyListeners.get(key);
  if (!set) keyListeners.set(key, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) keyListeners.delete(key);
  };
}

/**
 * Un titre GARDÉ sur l'appareil se lit depuis son fichier : jamais grisé, jamais sauté, quoi que sa source en dise
 * (l'application branche sa recherche de copie gardée, `buildOctavePlayer` → `isKept`). Rien de branché : aucun.
 */
let keptLookup: ((trackKey: string) => boolean) | null = null;

export function setKeptPlayabilityLookup(lookup: ((trackKey: string) => boolean) | null): void {
  keptLookup = lookup;
}

export function isKeptForPlayback(trackKey: string): boolean {
  return keptLookup?.(trackKey) ?? false;
}

/** Tests seulement. */
export function resetLearnedPlayability(): void {
  learned.clear();
  keptLookup = null;
}

export function onPlayabilityLearned(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** La file, chaque entrée de ce titre marquée illisible (la file la sautera) ; la même file si rien ne change. */
export function refusedQueue(queue: QueueState, key: string, reason: MusicPlayableReason | null): QueueState {
  return replaceTracks(queue, key, (track) => withPlayability(track, { playable: "no", reason }));
}
