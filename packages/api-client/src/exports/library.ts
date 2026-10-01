// La bibliothèque Jellyfin : le client, la navigation (bibliothèques, saisons,
// catalogue, accueil), la recherche et les personnes.
export { JellyfinClient, JellyfinError, type DirectStreamingState } from "../jellyfin";
export { JellyfinClientContext, useJellyfinClient } from "../hooks/useJellyfinClient";
export { useLibraries, useLibraryItems, useEpisodes, useSeriesEpisodes, useMediaItem, MEDIA_ITEM_FIELDS, useItemAncestors, useSimilarItems, useCollectionItems, useGenres, useStudios } from "../hooks/useLibrary";
export { useSeasons, prefetchSeasons, useSeasonEpisodesLite, prefetchSeasonEpisodesLite, getSeasonEpisodesLiteKey, SEASON_FIELDS } from "../hooks/useSeasons";
export {
  useSeasonEpisodeList, usePrefetchSeasonEpisodes, useAdjacentSeasonsPrefetch, getSeasonEpisodeSourcesKey, mergeSeasonSources,
  type SeasonEpisodeList,
} from "../hooks/useSeasonEpisodeList";
export { useSeasonBrowser, type SeasonBrowser, type SeasonBrowserOptions } from "../hooks/useSeasonBrowser";
export { useRandomLibraryBackdrop, getLibraryBackdropKey, prefetchLibraryBackdrop } from "../hooks/useLibraryBackdrop";
// Nouveautés de Jellyfin 12, derrière une détection de capacité : filtres de
// langues du catalogue, et « Fait partie de » (collections d'un titre).
export { useLibraryLanguages } from "../hooks/useLibraryLanguages";
export { parseLibraryLanguages, libraryLanguagesPath, languageValues, type LanguageOption, type LibraryLanguages } from "../hooks/libraryLanguages";
export { useIncludedInCollections, includedInPath, fetchIncludedInCollections } from "../hooks/useIncludedInCollections";
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
export { useResumeItems, useLatestItems, latestItemsQueryOptions, useNextUp, useWatchedItems, useFeaturedItems } from "../hooks/useHome";
export { useLocalTrailers, useSpecialFeatures } from "../hooks/useTrailers";
// Les extras d'une fiche, pour toutes les plateformes : locaux (bandes-annonces
// puis bonus), distants (Jellyfin + TMDB, triés par langue), et le bouton.
export { useItemExtras, type ExtrasOwner, type ItemExtras } from "../hooks/useItemExtras";
export { useRemoteTrailers, useRemoteTrailersState, type RemoteTrailersOwner } from "../hooks/useRemoteTrailers";
export { useItemTrailer, type ItemTrailer } from "../hooks/useItemTrailer";
