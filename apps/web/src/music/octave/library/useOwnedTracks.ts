/**
 * Octave — des titres montrés hors bibliothèque, chacun remplacé par celui de la bibliothèque qui l'est
 * (`useMusicLibraryMatch` : index local du cœur, en cache, relu quand la bibliothèque change).
 */

import { useMemo } from "react";
import { useMusicLibraryMatch } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { ownedTracks } from "./ownedItems";

export function useOwnedTracks(tracks: readonly MusicTrack[]): { tracks: readonly MusicTrack[]; settled: boolean } {
  const matches = useMusicLibraryMatch(tracks);
  const owned = useMemo(() => ownedTracks(tracks, matches.tracks), [tracks, matches.tracks]);
  return { tracks: owned, settled: matches.settled };
}
