// La bibliothèque Jellyfin : le client, la navigation (bibliothèques, saisons,
// catalogue, accueil), la recherche et les personnes.
export { JellyfinClient, JellyfinError, type DirectStreamingState } from "../jellyfin";
export { JellyfinClientContext, useJellyfinClient } from "../hooks/useJellyfinClient";
export { useLibraries, useLibraryItems, useEpisodes, useSeriesEpisodes, useMediaItem, useItemAncestors, useSimilarItems, useCollectionItems, useGenres, useStudios } from "../hooks/useLibrary";
export { useSeasons, prefetchSeasons, useSeasonEpisodesLite, prefetchSeasonEpisodesLite, getSeasonEpisodesLiteKey, SEASON_FIELDS } from "../hooks/useSeasons";
export {
  useSeasonEpisodeList, usePrefetchSeasonEpisodes, useAdjacentSeasonsPrefetch, getSeasonEpisodeSourcesKey, mergeSeasonSources,
  type SeasonEpisodeList,
} from "../hooks/useSeasonEpisodeList";
export { useRandomLibraryBackdrop, getLibraryBackdropKey, prefetchLibraryBackdrop } from "../hooks/useLibraryBackdrop";
export { useSearchItems } from "../hooks/useSearchItems";
// Le moteur de recherche du serveur Tentacle (web, bureau et mobile), et ce
// que les plugins trouvent hors de la bibliothèque.
export {
  useTentacleSearch, useSearchEpisodes, useSearchBrowse, useSearchDiscover,
  type SearchBrowseTarget, type TentacleSearchOptions,
} from "../hooks/useTentacleSearch";
export { useExternalSearch, combineExternal, type ExternalSearchOptions, type ExternalSearchState } from "../hooks/useExternalSearch";
export { useExternalFilmography, type ExternalFilmographyOptions, type FilmographyPerson } from "../hooks/useExternalFilmography";
export { usePersonDetails, usePersonFilmography, type PersonFilmography } from "../hooks/usePerson";
export { useLibraryCatalog, getLibraryCatalogKey, prefetchLibraryCatalog, type CatalogFilters } from "../hooks/useLibraryCatalog";
export { useResumeItems, useLatestItems, useNextUp, useWatchedItems, useFeaturedItems } from "../hooks/useHome";
export { useLocalTrailers, useSpecialFeatures } from "../hooks/useTrailers";
