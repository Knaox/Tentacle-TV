import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries } from "./cacheUtils";

interface BatchWatchedContext {
  seriesId: string;
  seasonId?: string;
}

export function useBatchWatchedToggle(ctx: BatchWatchedContext) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const seriesContext = { seriesId: ctx.seriesId, seasonId: ctx.seasonId };

  const markWatched = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/PlayedItems/${id}`, { method: "POST" })
        )
      ),
    onSettled: () => invalidateAllMediaQueries(qc, { seriesContext }),
  });

  const markUnwatched = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/PlayedItems/${id}`, { method: "DELETE" })
        )
      ),
    onSettled: () => invalidateAllMediaQueries(qc, { seriesContext }),
  });

  return { markWatched, markUnwatched };
}
