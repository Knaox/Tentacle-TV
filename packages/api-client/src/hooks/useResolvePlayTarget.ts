import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { fetchSeriesWatchState, type NextEpisodeResult } from "./useWatchState";

/**
 * « Lire » depuis une liste, sans une requête par ligne.
 *
 * Une série ne se lit pas telle quelle : il faut l'épisode à reprendre. Les
 * cartes délèguent donc à la fiche (`playTargetPath`) — une requête par carte
 * serait ruineuse sur une grille. Ici la résolution se fait AU GESTE, pour le
 * seul titre touché, et par la même clé de cache que `useSeriesWatchState` :
 * si la fiche l'a déjà calculée, rien ne repart.
 *
 * Rend l'identifiant à lire, ou `null` quand il n'y a rien à lire (série
 * terminée, épisodes introuvables) — l'appelant ouvre alors la fiche.
 */
export function useResolvePlayTarget() {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  return useCallback(
    async (item: MediaItem): Promise<string | null> => {
      if (item.Type !== "Series") return item.Id;
      if (!userId) return null;
      try {
        const state = await qc.fetchQuery<NextEpisodeResult>({
          queryKey: ["series-watch-state", item.Id],
          staleTime: 60_000,
          queryFn: () => fetchSeriesWatchState(client, userId, item.Id),
        });
        return state.type !== "completed" ? (state.episode?.Id ?? null) : null;
      } catch {
        return null;
      }
    },
    [client, userId, qc],
  );
}
