import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * TOUS les épisodes d'une série en une requête — « toute la série » du
 * dialogue « Garder hors ligne ». Mêmes champs que `useEpisodes` : tailles et
 * pistes de chaque épisode arrivent avec, sans requête par épisode.
 */
export function useSeriesEpisodes(seriesId: string | undefined, options?: { enabled?: boolean }) {
  const client = useJellyfinClient();
  const userId = useUserId();
  return useQuery({
    queryKey: ["series-episodes", seriesId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/${seriesId}/Episodes?userId=${userId}` +
            "&Fields=Overview,PrimaryImageAspectRatio,MediaSources,MediaStreams&EnableUserData=true",
        )
        .then((response) => response.Items),
    enabled: userId !== null && seriesId !== undefined && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000,
  });
}
