/**
 * Octave (mobile) — ce que les pages (m3, m4) lisent quand le réseau manque,
 * d'après les règles communes (`playableNow`, `playableQueue`, `searchKept`) :
 *   - `useTrackPlayable()` : une rangée atténuée et inerte hors ligne si son titre n'est pas gardé ;
 *   - `offlinePlayableQueue(tracks, index)` : la file à remettre au lecteur (hors ligne, les titres gardés) ;
 *   - `useKeptSearch(query)` : la recherche dans la musique gardée (hors ligne, à côté des recherches déjà faites).
 * En ligne : tout se lit, rien ne change.
 */

import { useCallback, useMemo } from "react";
import { deviceModel, playableNow, playableQueue, searchKept, type KeptSearchResult } from "@tentacle-tv/offline-core/music";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { isOfflineMode } from "../../offline/connectivityStore";
import { keptMusicResourceUri } from "../../offline/engineMusicApi";
import { useOfflineMode } from "../../offline/useOfflineMode";
import { keptMusicStore } from "./keptMusic";
import { useKeptMusic } from "./useKeptMusic";

export function useTrackPlayable(): (trackKey: string) => boolean {
  const offline = useOfflineMode();
  const kept = useKeptMusic();
  return useCallback((trackKey: string) => playableNow(trackKey, offline, kept.byKey), [offline, kept.byKey]);
}

/** La file à lancer (lu sans React : au toucher). `null` : rien de lisible hors ligne. */
export function offlinePlayableQueue(tracks: readonly MusicTrack[], index: number): { tracks: MusicTrack[]; index: number } | null {
  return playableQueue(tracks, index, isOfflineMode(), keptMusicStore.state().byKey);
}

export function useKeptSearch(query: string): KeptSearchResult {
  const kept = useKeptMusic();
  const model = useMemo(() => deviceModel(kept.tracks, kept.collections, keptMusicResourceUri, { completeOnly: true }), [kept.tracks, kept.collections]);
  return useMemo(() => searchKept(model.tracks, model.collections, query), [model, query]);
}
