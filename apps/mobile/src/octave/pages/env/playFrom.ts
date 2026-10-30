/**
 * Octave mobile — LANCER une liste depuis un titre, la règle du hors ligne
 * comprise (`offlinePlayableQueue`, axe m5) : en ligne, la liste telle quelle ;
 * hors ligne, ses seuls titres gardés sur l'appareil, en partant du titre
 * touché s'il l'est. Rien de lisible : rien ne part.
 */

import type { MusicTrack } from "@tentacle-tv/shared/music";
import { announceUnavailableTrack, isTrackUnavailable, rowClickAction, type OctavePlayer } from "@tentacle-tv/shared/octave";
import { offlinePlayableQueue } from "../../offline/useOfflineMusic";

export function playFrom(player: OctavePlayer | null, tracks: readonly MusicTrack[], index: number, contextId: string | null): void {
  if (!player) return;
  const queue = offlinePlayableQueue(tracks, index);
  if (queue) player.playList(queue.tracks, queue.index, contextId);
}

/**
 * Toucher la RANGÉE d'un titre (la règle du bureau, `pages/rowClick.ts`) : le titre en cours de cette liste se met
 * en pause ou reprend ; tout autre lance la liste depuis lui (`playFrom`) — un titre indisponible ne lance rien, l'avis
 * le dit (`unavailableTrack.ts`).
 */
export function playRow(player: OctavePlayer | null, tracks: readonly MusicTrack[], index: number, contextId: string): void {
  if (!player) return;
  const { current, queue } = player.snapshot.get();
  const track = tracks[index];
  const action = rowClickAction(track?.key, current?.key ?? null, queue.contextId, contextId, !!track && isTrackUnavailable(track));
  if (action === "unavailable") announceUnavailableTrack();
  else if (action === "toggle") player.togglePlay();
  else playFrom(player, tracks, index, contextId);
}
