import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";

export interface EpisodeNavigation {
  previousEpisode: MediaItem | null;
  nextEpisode: MediaItem | null;
  isLoading: boolean;
}

/**
 * Given a currently-playing episode, determines the previous and next episodes.
 * Uses the Jellyfin API to fetch all episodes in the series, then finds adjacents.
 */
export function useEpisodeNavigation(item: MediaItem | undefined): EpisodeNavigation {
  const client = useJellyfinClient();
  const userId = useUserId();
  const seriesId = item?.SeriesId;
  const isEpisode = item?.Type === "Episode";

  // Fetch ALL episodes for the series (across all seasons)
  const { data: episodes, isLoading } = useQuery({
    queryKey: ["all-episodes", seriesId],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Shows/${seriesId}/Episodes?userId=${userId}` +
            `&Fields=Overview,PrimaryImageAspectRatio&EnableImageTypes=Primary,Thumb&ImageTypeLimit=1`
        )
        .then((r) => r.Items),
    enabled: !!userId && !!seriesId && isEpisode,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    if (!episodes || !item || !isEpisode) {
      return { previousEpisode: null, nextEpisode: null, isLoading };
    }

    const currentIndex = episodes.findIndex((ep) => ep.Id === item.Id);
    if (currentIndex === -1) {
      return { previousEpisode: null, nextEpisode: null, isLoading: false };
    }

    return {
      previousEpisode: currentIndex > 0 ? episodes[currentIndex - 1] : null,
      nextEpisode: currentIndex < episodes.length - 1 ? episodes[currentIndex + 1] : null,
      isLoading: false,
    };
  }, [episodes, item, isEpisode, isLoading]);
}
