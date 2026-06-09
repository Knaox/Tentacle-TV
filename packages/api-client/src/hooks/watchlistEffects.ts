import type { QueryClient } from "@tanstack/react-query";
import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";
import { updateItemUserDataInCache, patchSeriesIdSet } from "./cacheUtils";

/** Query keys des Sets d'IDs de séries likées / favorites (cache = string[]). */
export const WATCHLIST_SERIES_IDS_KEY = ["watchlist-series-ids"] as const;
export const FAVORITE_SERIES_IDS_KEY = ["favorite-series-ids"] as const;

/** Listes flat (carrousel + page) à muter optimistiquement. */
export const WATCHLIST_LIST_KEYS = [["watchlist"], ["watchlist", "all"]] as const;
export const FAVORITE_LIST_KEYS = [["favorites"], ["favorites", "all"]] as const;

type Fetcher = {
  fetch: (path: string, init?: { method?: string }) => Promise<unknown>;
};

/** Status Jellyfin d'une série ("Continuing" / "Ended"), depuis le cache ou via fetch. */
async function getSeriesStatus(
  qc: QueryClient,
  client: Fetcher,
  userId: string,
  seriesId: string,
): Promise<string | undefined> {
  const cached = qc.getQueryData<MediaItem>(["item", seriesId])?.Status;
  if (cached !== undefined) return cached;
  const fresh = await client
    .fetch(`/Users/${userId}/Items/${seriesId}?Fields=Status`)
    .then((r) => r as MediaItem)
    .catch(() => null);
  return fresh?.Status;
}

/**
 * Retire une série de « Ma liste » (Likes) SI elle est entièrement vue.
 * Appelé après qu'un épisode (ou la série) ait été marqué vu / lu à 100%.
 *
 * - « entièrement vue » : ["series-watch-state", id].type === "completed"
 *   (exclut déjà la Saison 0 / spéciaux, cf. useSeriesWatchState).
 * - série EN COURS de diffusion (Status "Continuing") : on NE retire JAMAIS —
 *   d'autres épisodes arrivent, l'utilisateur veut garder le suivi.
 * - n'agit que si la série est effectivement dans Ma liste (Set ou UserData).
 * - retrait optimiste : série + tous ses épisodes en cache, + Set.
 */
export async function retireSeriesFromWatchlistIfFullyWatched(
  qc: QueryClient,
  client: Fetcher,
  userId: string | null | undefined,
  seriesId: string | undefined,
): Promise<void> {
  if (!seriesId || !userId) return;

  const state = qc.getQueryData<NextEpisodeResult>(["series-watch-state", seriesId]);
  if (state?.type !== "completed") return;

  const likedInSet = qc.getQueryData<string[]>(WATCHLIST_SERIES_IDS_KEY)?.includes(seriesId);
  const likedOnItem = qc.getQueryData<MediaItem>(["item", seriesId])?.UserData?.Likes === true;
  if (!likedInSet && !likedOnItem) return;

  // Série encore en diffusion → on la garde dans Ma liste.
  const status = await getSeriesStatus(qc, client, userId, seriesId);
  if (status === "Continuing") return;

  await client
    .fetch(`/Users/${userId}/Items/${seriesId}/Rating`, { method: "DELETE" })
    .catch(() => {});

  updateItemUserDataInCache(qc, { matchSeriesId: seriesId }, () => ({ Likes: false }));
  patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, seriesId, false);
  qc.invalidateQueries({ queryKey: ["watchlist"], refetchType: "none" });
}

/**
 * À l'AJOUT dans « Ma liste » : si la cible est DÉJÀ entièrement vue, on la
 * remet à zéro (marquée non-vue, progression effacée) pour la re-regarder à
 * neuf. Si elle est seulement commencée (pas 100%), on NE touche à RIEN → la
 * reprise reste où elle en est. Vaut pour une série (toute la série) comme un
 * film.
 */
export async function resetWatchedIfFullyWatchedOnAdd(
  qc: QueryClient,
  client: Fetcher,
  userId: string | null | undefined,
  targetId: string | undefined,
  seriesId: string | undefined,
): Promise<void> {
  if (!targetId || !userId) return;

  let fullyWatched = false;
  if (seriesId) {
    let state = qc.getQueryData<NextEpisodeResult>(["series-watch-state", seriesId]);
    if (!state) {
      await qc.refetchQueries({ queryKey: ["series-watch-state", seriesId] });
      state = qc.getQueryData<NextEpisodeResult>(["series-watch-state", seriesId]);
    }
    fullyWatched = state?.type === "completed";
  } else {
    let played = qc.getQueryData<MediaItem>(["item", targetId])?.UserData?.Played;
    if (played === undefined) {
      const fresh = await client
        .fetch(`/Users/${userId}/Items/${targetId}?EnableUserData=true`)
        .then((r) => r as MediaItem)
        .catch(() => null);
      played = fresh?.UserData?.Played;
    }
    fullyWatched = played === true;
  }
  if (!fullyWatched) return;

  await client
    .fetch(`/Users/${userId}/PlayedItems/${targetId}`, { method: "DELETE" })
    .catch(() => {});
  updateItemUserDataInCache(
    qc,
    seriesId ? { matchSeriesId: seriesId } : targetId,
    () => ({ Played: false, PlayedPercentage: 0 }),
  );
  if (seriesId) qc.invalidateQueries({ queryKey: ["series-watch-state", seriesId] });
}
