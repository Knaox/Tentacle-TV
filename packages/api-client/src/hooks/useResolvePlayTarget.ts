import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { seriesPlayTarget, type MediaItem, type SeriesPlayTarget } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { fetchSeriesWatchState, type NextEpisodeResult } from "./useWatchState";

/**
 * L'état de visionnage d'une série, AU GESTE, par la même clé de cache que
 * `useSeriesWatchState` : si la fiche l'a déjà calculé, rien ne repart.
 * `null` : pas de compte, ou la requête a échoué.
 */
function useSeriesStateAtGesture() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();
  return useCallback(async (seriesId: string): Promise<NextEpisodeResult | null> => {
    if (!userId) return null;
    try {
      return await qc.fetchQuery<NextEpisodeResult>({
        queryKey: ["series-watch-state", seriesId],
        staleTime: 60_000,
        queryFn: () => fetchSeriesWatchState(client, userId, seriesId),
      });
    } catch {
      return null;
    }
  }, [client, userId, qc]);
}

/**
 * « Lire » depuis une liste, sans une requête par ligne.
 *
 * Une série ne se lit pas telle quelle : il faut l'épisode à reprendre. Les
 * cartes délèguent donc à la fiche (`playTargetPath`) — une requête par carte
 * serait ruineuse sur une grille. Ici la résolution se fait AU GESTE, pour le
 * seul titre touché.
 *
 * Rend l'identifiant à lire, ou `null` quand il n'y a rien à lire (série
 * terminée, épisodes introuvables) — l'appelant ouvre alors la fiche.
 */
export function useResolvePlayTarget() {
  const stateOf = useSeriesStateAtGesture();
  return useCallback(async (item: MediaItem): Promise<string | null> => {
    if (item.Type !== "Series") return item.Id;
    const state = await stateOf(item.Id);
    return state && state.type !== "completed" ? state.episode.Id : null;
  }, [stateOf]);
}

/**
 * « Lecture » d'une bannière : une série entièrement vue s'y REVOIT depuis son
 * premier épisode au lieu de renvoyer à la fiche (règle `seriesPlayTarget`) ;
 * un titre qui n'est pas une série se lit tel quel. Jamais l'identifiant de
 * la série au lecteur : PlaybackInfo le refuse (500 de Jellyfin).
 */
export function useResolveSeriesPlay() {
  const stateOf = useSeriesStateAtGesture();
  return useCallback(async (item: MediaItem): Promise<SeriesPlayTarget> => {
    if (item.Type !== "Series") return { kind: "episode", episodeId: item.Id };
    return seriesPlayTarget(await stateOf(item.Id));
  }, [stateOf]);
}
