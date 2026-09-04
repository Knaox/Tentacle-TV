import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import { invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot, patchSeriesIdSet, addItemToLists, removeItemFromLists } from "./cacheUtils";
import { WATCHLIST_SERIES_IDS_KEY, WATCHLIST_LIST_KEYS, resetWatchedIfFullyWatchedOnAdd } from "./watchlistEffects";
import { forgetAutoRetired } from "./watchlistAutoRetired";

// MediaSources requis pour afficher le badge qualité (4K/HEVC/DV/etc.) sur
// les cards des rangées Ma Liste / Favoris (web CardMetaOverlay).
const FIELDS = "Overview,Genres,PrimaryImageAspectRatio,MediaSources,ProviderIds";
const IMAGE_OPTS = "EnableImageTypes=Primary,Backdrop,Thumb&ImageTypeLimit=1";

export function useWatchlist() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["watchlist"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=Likes&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Limit=20&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

/**
 * Toggle « Ma liste » (Likes) sur un item.
 *
 * `opts.seriesId` (= itemId quand la cible EST une série) active la propagation
 * optimiste vers tous les épisodes de la série en cache + la maj du Set
 * `watchlist-series-ids`. Pour un film, laisser `seriesId` indéfini.
 */
export function useToggleWatchlist(
  itemId: string | undefined,
  opts?: { seriesId?: string; listItem?: MediaItem },
) {
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
    // Carrousel/page « Ma liste » : refetch immédiat (l'item apparaît/disparaît).
    qc.invalidateQueries({ queryKey: ["watchlist"], refetchType: "active" });
    qc.invalidateQueries({ queryKey: WATCHLIST_SERIES_IDS_KEY });
  };

  const add = useMutation({
    mutationFn: () =>
      client.fetch(`/Users/${userId}/Items/${itemId}/Rating?likes=true`, { method: "POST" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, { matchId: itemId, matchSeriesId: seriesId }, () => ({ Likes: true }));
      patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, seriesId, true, snapshot);
      // Insertion optimiste dans le carrousel (Movie/Series direct ; un ajout
      // via épisode n'a pas l'item série → couvert par le refetch de settle).
      if (listItem) {
        const optimistic: MediaItem = { ...listItem, UserData: { ...listItem.UserData, Likes: true } as MediaItem["UserData"] };
        addItemToLists(qc, WATCHLIST_LIST_KEYS, optimistic, snapshot);
      }
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    // Ajouté à Ma liste alors que c'est déjà vu à 100% → on remet à zéro
    // (re-regarder à neuf). Si seulement commencé, on laisse la reprise.
    onSuccess: () => {
      resetWatchedIfFullyWatchedOnAdd(qc, client, userId, itemId, seriesId);
      // L'utilisateur a repris la main : la série ne reviendra plus d'elle-même.
      void forgetAutoRetired(seriesId);
    },
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: () =>
      client.fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["item", itemId] });
      const snapshot = updateItemUserDataInCache(qc, { matchId: itemId, matchSeriesId: seriesId }, () => ({ Likes: false }));
      patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, seriesId, false, snapshot);
      // Retrait optimiste du carrousel/page « Ma liste ».
      removeItemFromLists(qc, WATCHLIST_LIST_KEYS, itemId, snapshot);
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) restoreFromSnapshot(qc, ctx.snapshot);
    },
    // Un retrait manuel n'a pas de suivi en principe — sauf remise serveur qui
    // aurait croisé le geste : on efface par précaution, le geste prime.
    onSuccess: () => {
      void forgetAutoRetired(seriesId);
    },
    onSettled: settle,
  });

  return { add, remove };
}

/** Toggle Ma liste en routant un ÉPISODE vers sa SÉRIE parente. */
export function useToggleWatchlistForItem(item: MediaItem) {
  const targetId = item.Type === "Episode" ? item.SeriesId : item.Id;
  const isSeriesTarget = item.Type === "Episode" || item.Type === "Series";
  // Un épisode n'a pas l'item série → pas d'insertion optimiste (refetch couvre).
  const listItem = item.Type === "Episode" ? undefined : item;
  return useToggleWatchlist(targetId, { seriesId: isSeriesTarget ? targetId : undefined, listItem });
}

export function useFavorites() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["favorites"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=IsFavorite&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Limit=20&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useWatchlistAll() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["watchlist", "all"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=Likes&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}

export function useFavoritesAll() {
  const client = useJellyfinClient();
  const userId = useUserId();

  return useQuery({
    queryKey: ["favorites", "all"],
    queryFn: () =>
      client
        .fetch<{ Items: MediaItem[] }>(
          `/Users/${userId}/Items?Filters=IsFavorite&Recursive=true` +
            `&IncludeItemTypes=Movie,Series&SortBy=DateCreated&SortOrder=Descending` +
            `&Fields=${FIELDS}&${IMAGE_OPTS}&EnableUserData=true`
        )
        .then((r) => r.Items),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
