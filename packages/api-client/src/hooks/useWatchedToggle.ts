import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import {
  invalidateAllMediaQueries,
  updateItemUserDataInCache,
  restoreFromSnapshot,
  type CacheTarget,
} from "./cacheUtils";

interface WatchedToggleContext {
  /** Présent UNIQUEMENT quand l'item est un ÉPISODE → id de la série parente. */
  seriesId?: string;
  seasonId?: string;
  /**
   * Type de l'item ("Movie" | "Series" | "Episode") : une SÉRIE étend le patch
   * de cache à tous ses épisodes (cf. `target`).
   */
  itemType?: string;
}

/**
 * Marquer vu / non vu, À LA MAIN.
 *
 * « Ma liste » n'est PAS touchée : cocher « vu » est un geste de rangement, pas
 * un visionnage. Seule une lecture menée jusqu'au bout retire un titre de Ma
 * liste — voir `useWatchStopInvalidation` et `watchlistEffects`.
 */
export function useWatchedToggle(itemId: string | undefined, context?: WatchedToggleContext) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const seriesContext = context?.seriesId
    ? { seriesId: context.seriesId, seasonId: context.seasonId }
    : undefined;

  /**
   * Cible du patch optimiste. Sur une SÉRIE, elle englobe ses épisodes : c'est
   * ce que fait le serveur (`/PlayedItems/{seriesId}` marque toute la série), et
   * le cache doit dire la même chose. Sans ça, la vignette « +N nouveaux
   * épisodes » des derniers ajouts — dont l'état se déduit des épisodes groupés
   * (cf. `groupLatestByRuns`) — restait sur l'ancienne valeur jusqu'au refetch.
   */
  const target: CacheTarget =
    context?.itemType === "Series" && itemId ? { matchId: itemId, matchSeriesId: itemId } : itemId!;

  const markWatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, target, () => ({
        Played: true,
        PlayedPercentage: 100,
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSettled: () => invalidateAllMediaQueries(qc, { itemId, seriesContext }),
  });

  const markUnwatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, target, () => ({
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
