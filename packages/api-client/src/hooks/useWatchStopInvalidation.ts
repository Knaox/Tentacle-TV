import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { updateItemUserDataInCache, patchSeriesIdSet } from "./cacheUtils";
import { retireSeriesFromWatchlistIfFullyWatched, WATCHLIST_SERIES_IDS_KEY } from "./watchlistEffects";

const STOP_INVALIDATE_KEYS = ["resume-items", "next-up", "watched-items", "watchlist"] as const;

interface StopArgs {
  itemId?: string;
  /** Présent si l'item lu est un ÉPISODE → série parente. */
  seriesId?: string;
  itemType?: string;
}

/**
 * Logique d'invalidation à l'ARRÊT de lecture, partagée web/desktop.
 *
 * Retrait de « Ma liste » à 100% vu :
 * - Film / série : on retire le like UNIQUEMENT si Jellyfin a marqué l'item
 *   `Played` (≥ seuil), pas au simple lancement du player.
 * - Épisode : on ne touche pas au like de l'épisode ; si la série devient
 *   entièrement vue, c'est ELLE qui quitte Ma liste.
 */
export function useWatchStopInvalidation() {
  const qc = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();

  return useCallback(
    async ({ itemId, seriesId, itemType }: StopArgs) => {
      if (!itemId || !userId) return;

      if (itemType === "Episode" && seriesId) {
        await qc.refetchQueries({ queryKey: ["series-watch-state", seriesId] });
        await retireSeriesFromWatchlistIfFullyWatched(qc, client, userId, seriesId);
      } else {
        const fresh = await client
          .fetch<MediaItem>(`/Users/${userId}/Items/${itemId}?EnableUserData=true`)
          .catch(() => null);
        if (fresh?.UserData?.Played === true) {
          await client
            .fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" })
            .catch(() => {});
          updateItemUserDataInCache(qc, itemId, () => ({ Likes: false }));
          patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, itemId, false);
        }
      }

      qc.invalidateQueries({ queryKey: ["item", itemId] });
      for (const k of STOP_INVALIDATE_KEYS) qc.invalidateQueries({ queryKey: [k] });
      qc.invalidateQueries({ queryKey: WATCHLIST_SERIES_IDS_KEY });
    },
    [qc, client, userId],
  );
}
