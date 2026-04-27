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
    // Batch (saison entière) : refetch immédiat des listes liées à la série
    // pour refléter l'état "tous les épisodes vus" sans attendre le prochain focus.
    onSettled: () => invalidateAllMediaQueries(qc, { seriesContext, refetchSeriesContext: true }),
  });

  const markUnwatched = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.allSettled(
        ids.map((id) =>
          client.fetch(`/Users/${userId}/PlayedItems/${id}`, { method: "DELETE" })
        )
      ),
    onSettled: () => invalidateAllMediaQueries(qc, { seriesContext, refetchSeriesContext: true }),
  });

  return { markWatched, markUnwatched };
}
