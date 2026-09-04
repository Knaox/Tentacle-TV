import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import type { MediaItem } from "@tentacle-tv/shared";
import { getNextEpisode } from "@tentacle-tv/shared";
import type { NextEpisodeResult } from "@tentacle-tv/shared";

export type { NextEpisodeResult };

/** Ce qu'il faut du client Jellyfin — sa forme, pour que ça se teste. */
export interface EpisodesFetcher {
  fetch(path: string): Promise<unknown>;
}

/**
 * L'état de visionnage d'une série, calculé sur tous ses épisodes triés par
 * saison puis numéro, Saison 0 exclue (spéciaux, OVA — souvent sans fichier).
 * C'est la `queryFn` de `useSeriesWatchState`, exposée telle quelle pour que
 * le rangement de sortie du lecteur puisse l'obtenir même quand aucune fiche
 * ne l'a mise en cache (cf. `watchlistEffects`).
 *
 * Une réponse sans `Items` est une ERREUR, pas une série vide : sur une liste
 * vide `getNextEpisode` rend « terminée », et ce verdict-là retire de Ma liste.
 */
export async function fetchSeriesWatchState(
  client: EpisodesFetcher,
  userId: string,
  seriesId: string,
): Promise<NextEpisodeResult> {
  const params = new URLSearchParams({
    userId,
    fields: "Overview,PrimaryImageAspectRatio",
    enableUserData: "true",
  });
  const data = (await client.fetch(`/Shows/${seriesId}/Episodes?${params}`)) as { Items?: unknown } | null;
  if (!data || !Array.isArray(data.Items)) throw new Error(`Episodes ${seriesId} : réponse sans Items`);

  const episodes = (data.Items as MediaItem[])
    .filter((ep) => (ep.ParentIndexNumber ?? 0) > 0)
    .sort((a, b) => {
      const sa = a.ParentIndexNumber ?? 0;
      const sb = b.ParentIndexNumber ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0);
    });
  return getNextEpisode(episodes);
}

/**
 * Fetch all episodes for a series and compute the strict "next episode" result.
 * Uses the Jellyfin Episodes endpoint sorted by season then episode number.
 */
export function useSeriesWatchState(seriesId: string | undefined) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery<NextEpisodeResult>({
    queryKey: ["series-watch-state", seriesId],
    enabled: !!seriesId && !!userId,
    staleTime: 60_000,
    queryFn: () => fetchSeriesWatchState(client, userId!, seriesId!),
  });
}

/**
 * Fetch "Continue Watching" items from Jellyfin.
 * Returns items with PlaybackPositionTicks > 0 and Played = false,
 * sorted by LastPlayedDate (most recent first).
 */
export function useContinueWatching(limit = 20) {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery<MediaItem[]>({
    queryKey: ["continue-watching", limit],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({
        mediaTypes: "Video",
        limit: String(limit),
        fields: "Overview,PrimaryImageAspectRatio",
        enableUserData: "true",
      });

      const data = await client.fetch<{ Items: MediaItem[] }>(
        `/Users/${userId}/Items/Resume?${params}`
      );

      return data.Items || [];
    },
  });
}
