/**
 * Octave mobile — « Garder hors ligne » / « Retirer de cet appareil » pour UN
 * titre (le `KeepMenuItem` du bureau) : la surface de m5 (`useOfflineSurface` :
 * droit hors ligne du compte de l'appareil, extension) et sa règle
 * `canKeepTrack`. Sans le droit : `none` — sauf un titre déjà gardé, qu'on peut
 * toujours retirer. Gardé d'ici, le titre est retenu pour lui-même.
 */

import { useCallback } from "react";
import { canKeepTrack, holdKey, trackPhase } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { useOfflineSurface } from "../../offline/musicOfflineContext";
import { useKeepGestures } from "../../offline/useKeepGestures";
import { useKeptTrack } from "../../offline/useKeptMusic";

export function useTrackKeep(track: MusicTrack): { state: "keep" | "remove" | "none"; run: () => void } {
  const surface = useOfflineSurface();
  const kept = useKeptTrack(track.key);
  const gestures = useKeepGestures();
  const phase = trackPhase(kept);
  const state = phase !== "none" && kept ? "remove" : surface.visible && canKeepTrack(track, surface) ? "keep" : "none";
  const run = useCallback(() => {
    if (state === "remove" && kept) void gestures.remove([kept], holdKey(track.key));
    else if (state === "keep") void gestures.keep([track], { key: holdKey(track.key), kind: "track", title: track.title, subtitle: null, trackKeys: [track.key] });
  }, [gestures, kept, state, track]);
  return { state, run };
}
