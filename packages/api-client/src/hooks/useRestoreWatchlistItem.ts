import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { addItemToLists, invalidateAllMediaQueries, patchSeriesIdSet, restoreFromSnapshot, updateItemUserDataInCache } from "./cacheUtils";
import { WATCHLIST_LIST_KEYS, WATCHLIST_SERIES_IDS_KEY } from "./watchlistEffects";
import { forgetAutoRetired } from "./watchlistAutoRetired";

/**
 * « Annuler » après un retrait de Ma liste : remettre le titre TEL QU'IL ÉTAIT.
 *
 * Ce n'est pas un ajout. L'ajout (`useToggleWatchlist().add`) remet à zéro un
 * titre déjà vu en entier — on l'ajoute pour le revoir. Une annulation, elle,
 * doit rendre l'état d'avant le geste : un film terminé reste terminé. Même
 * requête, mêmes effets de cache, sans la remise à zéro.
 */
export function useRestoreWatchlistItem(item: MediaItem) {
  const client = useJellyfinClient();
  const userId = useUserId();
  const qc = useQueryClient();
  const seriesId = item.Type === "Series" ? item.Id : undefined;

  return useMutation({
    mutationFn: () => client.fetch(`/Users/${userId}/Items/${item.Id}/Rating?likes=true`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", item.Id] });
      const snapshot = updateItemUserDataInCache(qc, { matchId: item.Id, matchSeriesId: seriesId }, () => ({ Likes: true }));
      patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, seriesId, true, snapshot);
      const restored: MediaItem = { ...item, UserData: { ...item.UserData, Likes: true } as MediaItem["UserData"] };
      addItemToLists(qc, WATCHLIST_LIST_KEYS, restored, snapshot);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    onSuccess: () => {
      void forgetAutoRetired(seriesId);
    },
    onSettled: () => {
      invalidateAllMediaQueries(qc, { itemId: item.Id, seriesContext: seriesId ? { seriesId } : undefined });
      qc.invalidateQueries({ queryKey: ["watchlist"], refetchType: "active" });
      qc.invalidateQueries({ queryKey: WATCHLIST_SERIES_IDS_KEY });
    },
  });
}
