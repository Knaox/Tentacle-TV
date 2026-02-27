import { useQuery } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import type { MediaItem } from "@tentacle-tv/shared";
import { getNextEpisode } from "@tentacle-tv/shared";
import type { NextEpisodeResult } from "@tentacle-tv/shared";

export type { NextEpisodeResult };

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
    queryFn: async () => {
      // Fetch all episodes for this series
      const params = new URLSearchParams({
        userId: userId!,
        fields: "Overview,PrimaryImageAspectRatio",
        enableUserData: "true",
      });

      const data = await client.fetch<{ Items: MediaItem[] }>(
        `/Shows/${seriesId}/Episodes?${params}`
      );

      const episodes = (data.Items || []).sort((a, b) => {
        const sa = a.ParentIndexNumber ?? 0;
        const sb = b.ParentIndexNumber ?? 0;
        if (sa !== sb) return sa - sb;
        return (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0);
      });

      return getNextEpisode(episodes);
    },
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
