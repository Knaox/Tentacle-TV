import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserItemData } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import {
  invalidateAllMediaQueries,
  updateItemUserDataInCache,
  restoreFromSnapshot,
  patchSeriesIdSet,
  removeItemFromLists,
} from "./cacheUtils";
import {
  retireSeriesFromWatchlistIfFullyWatched,
  WATCHLIST_SERIES_IDS_KEY,
  WATCHLIST_LIST_KEYS,
} from "./watchlistEffects";

interface WatchedToggleContext {
  /** Présent UNIQUEMENT quand l'item est un ÉPISODE → id de la série parente. */
  seriesId?: string;
  seasonId?: string;
  /** Type de l'item ("Movie" | "Series" | "Episode") pour router le retrait Ma liste. */
  itemType?: string;
}

export function useWatchedToggle(itemId: string | undefined, context?: WatchedToggleContext) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();

  const seriesContext = context?.seriesId
    ? { seriesId: context.seriesId, seasonId: context.seasonId }
    : undefined;
  const isEpisodeFlow = !!seriesContext;

  // Film (ou type inconnu non-série) marqué vu → quitte Ma liste tout de suite.
  // Série marquée vue → décision déléguée (retrait seulement si terminée).
  const clearLike = !isEpisodeFlow && context?.itemType !== "Series";
  // Série dont on doit ré-évaluer l'appartenance à Ma liste après visionnage.
  const retireSeriesId = isEpisodeFlow
    ? seriesContext!.seriesId
    : context?.itemType === "Series"
      ? itemId
      : undefined;

  const markWatched = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/PlayedItems/${itemId}`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const patch: Partial<UserItemData> = clearLike
        ? { Played: true, PlayedPercentage: 100, Likes: false }
        : { Played: true, PlayedPercentage: 100 };
      const snapshot = updateItemUserDataInCache(qc, itemId!, () => patch);
      if (clearLike) {
        patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, itemId, false, snapshot);
        removeItemFromLists(qc, WATCHLIST_LIST_KEYS, itemId, snapshot);
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSuccess: () => {
      // Film : retrait du like côté serveur (différé, non bloquant).
      if (clearLike) {
        setTimeout(() => {
          client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }).catch(() => {});
        }, 0);
      }
    },
    onSettled: async () => {
      invalidateAllMediaQueries(qc, { itemId, seriesContext });
      qc.invalidateQueries({ queryKey: WATCHLIST_SERIES_IDS_KEY });
      if (clearLike) qc.invalidateQueries({ queryKey: ["watchlist"], refetchType: "active" });
      // Série (via épisode OU marquée vue directement) : retrait de Ma liste
      // seulement si entièrement vue ET terminée (pas "Continuing").
      if (retireSeriesId) {
        await qc.refetchQueries({ queryKey: ["series-watch-state", retireSeriesId] });
        await retireSeriesFromWatchlistIfFullyWatched(qc, client, userId, retireSeriesId);
      }
    },
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
