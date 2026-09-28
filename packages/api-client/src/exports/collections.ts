// Ma liste, les favoris et le « vu » : les listes, leurs filtres et bilans,
// les gestes en lot, la synchronisation du cache et l'état de visionnage.
export { useFavorite, useFavoriteForItem } from "../hooks/useFavorite";
export { useWatchlist, useToggleWatchlist, useToggleWatchlistForItem, useFavorites, useWatchlistAll, useFavoritesAll } from "../hooks/useWatchlist";
export { useWatchlistSeriesIds, useFavoriteSeriesIds, seriesStateId } from "../hooks/useSeriesListMembership";
export { filterCollection, collectionGenres, type CollectionFilterInput, type CollectionTypeTab } from "../utils/collectionFilter";
export {
  watchStage, watchProgress, watchRemaining, summarizeWatchlist, filterByWatchStage, resumeQueue, parseWatchStageFilter,
  WATCH_STAGE_FILTERS, type WatchStage, type WatchStageFilter, type WatchlistSummary, type RemainingInfo,
} from "../utils/watchlistProgress";
export { useResolvePlayTarget } from "../hooks/useResolvePlayTarget";
export { useRestoreWatchlistItem } from "../hooks/useRestoreWatchlistItem";
export { favoriteWatchState, summarizeFavorites, groupFavorites, favoritesGroupLabel, isFavoritesGroupMode, FAVORITES_GROUP_MODES, type FavoriteWatchState, type FavoritesSummary, type FavoritesGroup, type FavoritesGroupMode } from "../utils/favoritesOverview";
export { useWatchedToggle } from "../hooks/useWatchedToggle";
export { useWatchStopInvalidation } from "../hooks/useWatchStopInvalidation";

// Batch remove
export { useBatchRemoveFavorites, useBatchRemoveWatchlist } from "../hooks/useBatchRemove";

// Batch watched toggle
export { useBatchWatchedToggle } from "../hooks/useBatchWatchedToggle";

// Cache utilities for cross-platform state sync
export {
  invalidateSeriesWatchViews, invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot, patchSeriesIdSet,
  type CacheTarget,
} from "../hooks/cacheUtils";
export { retireSeriesFromWatchlistIfFullyWatched, WATCHLIST_SERIES_IDS_KEY, FAVORITE_SERIES_IDS_KEY } from "../hooks/watchlistEffects";
export { forgetAutoRetired, recordAutoRetired } from "../hooks/watchlistAutoRetired";

// Watch state & continue watching
export { useSeriesWatchState, useContinueWatching, type NextEpisodeResult } from "../hooks/useWatchState";
