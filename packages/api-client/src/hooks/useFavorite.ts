import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot, patchSeriesIdSet, addItemToLists, removeItemFromLists } from "./cacheUtils";
import { FAVORITE_SERIES_IDS_KEY, FAVORITE_LIST_KEYS } from "./watchlistEffects";

/**
 * Toggle « Favoris » (IsFavorite). `opts.seriesId` (= itemId quand la cible EST
 * une série) propage l'état à tous les épisodes de la série en cache + le Set
 * `favorite-series-ids`.
 */
export function useFavorite(itemId: string | undefined, opts?: { seriesId?: string; listItem?: MediaItem }) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();
  const seriesId = opts?.seriesId;
  const listItem = opts?.listItem;

  const settle = () => {
    invalidateAllMediaQueries(qc, {
      itemId,
      seriesContext: seriesId ? { seriesId } : undefined,
    });
    // Carrousel/page « Favoris » : refetch immédiat.
    qc.invalidateQueries({ queryKey: ["favorites"], refetchType: "active" });
    qc.invalidateQueries({ queryKey: FAVORITE_SERIES_IDS_KEY });
  };

  const add = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, { matchId: itemId, matchSeriesId: seriesId }, () => ({ IsFavorite: true }));
      patchSeriesIdSet(qc, FAVORITE_SERIES_IDS_KEY, seriesId, true, snapshot);
      if (listItem) {
        const optimistic: MediaItem = { ...listItem, UserData: { ...listItem.UserData, IsFavorite: true } as MediaItem["UserData"] };
        addItemToLists(qc, FAVORITE_LIST_KEYS, optimistic, snapshot);
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, { matchId: itemId, matchSeriesId: seriesId }, () => ({ IsFavorite: false }));
      patchSeriesIdSet(qc, FAVORITE_SERIES_IDS_KEY, seriesId, false, snapshot);
      removeItemFromLists(qc, FAVORITE_LIST_KEYS, itemId, snapshot);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSettled: settle,
  });

  return { add, remove };
}

/** Toggle Favoris en routant un ÉPISODE vers sa SÉRIE parente. */
export function useFavoriteForItem(item: MediaItem) {
  const targetId = item.Type === "Episode" ? item.SeriesId : item.Id;
  const isSeriesTarget = item.Type === "Episode" || item.Type === "Series";
  const listItem = item.Type === "Episode" ? undefined : item;
  return useFavorite(targetId, { seriesId: isSeriesTarget ? targetId : undefined, listItem });
}
