/**
 * Octave — les ENTRÉES de la file : un `uid` neuf par entrée, et le battage.
 * Module à part pour que `queueModel` et `queueFiles` le partagent sans
 * s'importer l'un l'autre.
 */

import type { MusicTrack } from "../music";
import type { QueueItem, Random } from "./queueModel";

let uidSeq = 0;
function nextUid(): string {
  uidSeq += 1;
  return `q${uidSeq.toString(36)}`;
}

export function wrapTracks(tracks: readonly MusicTrack[]): QueueItem[] {
  return tracks.map((track) => ({ uid: nextUid(), track }));
}

/** Fisher-Yates, sur une copie. */
export function shuffled<T>(list: readonly T[], random: Random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
