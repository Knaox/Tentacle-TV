import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot } from "./cacheUtils";

interface WatchedToggleContext {
  seriesId?: string;
  seasonId?: string;
}

export function useWatchedToggle(itemId: string | undefined, context?: WatchedToggleContext) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const seriesContext = context?.seriesId
    ? { seriesId: context.seriesId, seasonId: context.seasonId }
    : undefined;

  const markWatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, itemId!, () => ({
        Played: true,
        PlayedPercentage: 100,
        Likes: false,
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSuccess: () => {
      // Remove from personal watchlist in Jellyfin DB
      client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
    },
    onSettled: () => invalidateAllMediaQueries(qc, { itemId, seriesContext }),
  });

  const markUnwatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, itemId!, () => ({
        Played: false,
        PlayedPercentage: 0,
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSettled: () => invalidateAllMediaQueries(qc, { itemId, seriesContext }),
  });

  return { markWatched, markUnwatched };
}
