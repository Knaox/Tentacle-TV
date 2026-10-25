/**
 * Octave — les entrées EN ATTENTE du compte (point 4) : `useMusicPending` d'A5,
 * relu à `music:pending` et `music:resolved`. Sans extension qui le déclare :
 * liste vide, aucune requête.
 */

import { useMusicPending } from "@tentacle-tv/api-client";
import type { PendingMusicItem } from "@tentacle-tv/shared/music";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export function usePendingMusic(): PendingMusicItem[] {
  return useMusicPending(useOctaveProvider()).data.items;
}
