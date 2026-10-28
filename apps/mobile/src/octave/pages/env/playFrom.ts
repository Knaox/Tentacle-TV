/**
 * Octave mobile — LANCER une liste depuis un titre, la règle du hors ligne
 * comprise (`offlinePlayableQueue`, axe m5) : en ligne, la liste telle quelle ;
 * hors ligne, ses seuls titres gardés sur l'appareil, en partant du titre
 * touché s'il l'est. Rien de lisible : rien ne part.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import type { OctavePlayer } from "@tentacle-tv/shared/octave";
import { offlinePlayableQueue } from "../../offline/useOfflineMusic";

export function playFrom(player: OctavePlayer | null, tracks: readonly MusicTrack[], index: number, contextId: string | null): void {
  if (!player) return;
  const queue = offlinePlayableQueue(tracks, index);
  if (queue) player.playList(queue.tracks, queue.index, contextId);
}
