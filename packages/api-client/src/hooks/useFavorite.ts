import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries, addItemToLists, removeItemFromLists, type CacheTarget } from "./cacheUtils";
import { fetchMediaItem } from "./useLibrary";
import {
  beginUserDataGesture, failUserDataGesture, settleUserDataGesture, type UserDataGestureContext,
} from "./userDataGesture";
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

  const target: CacheTarget = { matchId: itemId, matchSeriesId: seriesId };

  const settle = (context: UserDataGestureContext | undefined) => {
    invalidateAllMediaQueries(qc, {
      itemId,
      seriesContext: seriesId ? { seriesId } : undefined,
    });
    // Carrousel/page « Favoris » : refetch immédiat.
    qc.invalidateQueries({ queryKey: ["favorites"], refetchType: "active" });
    const set = qc.invalidateQueries({ queryKey: FAVORITE_SERIES_IDS_KEY });
    // Le geste tient jusqu'à ce que l'ensemble (une série) ou la fiche disent la vérité.
    void settleUserDataGesture(qc, context, {
      itemId, fetchItem: (id) => fetchMediaItem(client, userId, id), refetches: seriesId ? [set] : [],
    });
  };

  const add = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "POST" }),
    // Un échec se DIT (la plateforme écoute son cache de mutations) : le geste est déjà défait.
    meta: { failureTitle: "errors:toastFavoriteFailed" },
    onMutate: async () => {
      const context = await beginUserDataGesture(qc, {
        itemId, target, patch: { IsFavorite: true }, seriesSet: { key: FAVORITE_SERIES_IDS_KEY, seriesId, add: true },
      });
      if (listItem) {
        const optimistic: MediaItem = { ...listItem, UserData: { ...listItem.UserData, IsFavorite: true } as MediaItem["UserData"] };
        addItemToLists(qc, FAVORITE_LIST_KEYS, optimistic, context.snapshot);
      }
      return context;
    },
    onError: (_err, _vars, ctx) => failUserDataGesture(qc, ctx),
    onSettled: (_data, error, _vars, ctx) => settle(error ? undefined : ctx),
  });

  const remove = useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/FavoriteItems/${itemId}`, { method: "DELETE" }),
    meta: { failureTitle: "errors:toastFavoriteFailed" },
    onMutate: async () => {
      const context = await beginUserDataGesture(qc, {
        itemId, target, patch: { IsFavorite: false }, seriesSet: { key: FAVORITE_SERIES_IDS_KEY, seriesId, add: false },
      });
      removeItemFromLists(qc, FAVORITE_LIST_KEYS, itemId, context.snapshot);
      return context;
    },
    onError: (_err, _vars, ctx) => failUserDataGesture(qc, ctx),
    onSettled: (_data, error, _vars, ctx) => settle(error ? undefined : ctx),
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
