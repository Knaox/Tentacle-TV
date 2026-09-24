export { JellyfinClient, JellyfinError, type DirectStreamingState } from "./jellyfin";
export { JellyfinClientContext, useJellyfinClient } from "./hooks/useJellyfinClient";
export { useLibraries, useLibraryItems, useEpisodes, useSeriesEpisodes, useMediaItem, useItemAncestors, useSimilarItems, useCollectionItems, useGenres, useStudios } from "./hooks/useLibrary";
export { useSeasons, prefetchSeasons, useSeasonEpisodesLite, prefetchSeasonEpisodesLite, getSeasonEpisodesLiteKey } from "./hooks/useSeasons";
export { useRandomLibraryBackdrop, getLibraryBackdropKey, prefetchLibraryBackdrop } from "./hooks/useLibraryBackdrop";
export { useSearchItems } from "./hooks/useSearchItems";
// Le moteur de recherche du serveur Tentacle (web, bureau et mobile), et ce
// que les plugins trouvent hors de la bibliothèque.
export {
  useTentacleSearch, useSearchEpisodes, useSearchBrowse, useSearchDiscover,
  type SearchBrowseTarget, type TentacleSearchOptions,
} from "./hooks/useTentacleSearch";
export { useExternalSearch, combineExternal, type ExternalSearchOptions, type ExternalSearchState } from "./hooks/useExternalSearch";
export { useExternalFilmography, type ExternalFilmographyOptions, type FilmographyPerson } from "./hooks/useExternalFilmography";
export { useLibraryCatalog, getLibraryCatalogKey, prefetchLibraryCatalog, type CatalogFilters } from "./hooks/useLibraryCatalog";
export { useResumeItems, useLatestItems, useNextUp, useWatchedItems, useFeaturedItems } from "./hooks/useHome";
export { useLocalTrailers, useSpecialFeatures } from "./hooks/useTrailers";
export { useFavorite, useFavoriteForItem } from "./hooks/useFavorite";
export { useWatchlist, useToggleWatchlist, useToggleWatchlistForItem, useFavorites, useWatchlistAll, useFavoritesAll } from "./hooks/useWatchlist";
export { useWatchlistSeriesIds, useFavoriteSeriesIds, seriesStateId } from "./hooks/useSeriesListMembership";
export { useSeriesRatings, SERIES_RATINGS_KEY } from "./hooks/useSeriesRatings";
export { filterCollection, collectionGenres, type CollectionFilterInput, type CollectionTypeTab } from "./utils/collectionFilter";
export { useWatchedToggle } from "./hooks/useWatchedToggle";
export { useWatchStopInvalidation } from "./hooks/useWatchStopInvalidation";
export { useStream, type StreamOptions } from "./hooks/useStream";
export { useAuth } from "./hooks/useAuth";
export { useUserId, notifyUserChange } from "./hooks/useUserId";
export { usePlaybackReporting, type PlaybackReportingOptions, type PlaybackReporter } from "./hooks/usePlayback";
// Destruction d'un transcode actif, hors du hook de reporting : les filets de
// lecture renégocient une session sans en tenir un (cf. useWebPlaybackFallbacks).
export { killActiveEncoding } from "./hooks/playbackTransport";
export { useEpisodeNavigation, type EpisodeNavigation } from "./hooks/useEpisodeNavigation";
export {
  useIntroSkipper, normalizeSkipSegments,
  type SkipSegments, type RawSkipSources, type MediaSegmentsResponse, type PluginSegmentDict, type PluginTimestamps,
} from "./hooks/useIntroSkipper";
// Segments de lecture — le contrat résolu par le backend, les réglages
// partagés du compte, et LA coquille d'overlay des six surfaces.
export { usePlaybackSegments } from "./hooks/usePlaybackSegments";
export {
  usePlaybackSettings, usePlaybackSettingsStore, setPlaybackSettings, rehydratePlaybackSettings, initPlaybackSettingsStore,
  setGroupPlaybackSettings, groupPlaybackSettings, useOwnPlaybackSettings,
} from "./hooks/usePlaybackSettings";
export { usePlaybackOverlay } from "./playback/usePlaybackOverlay";
export type { SkipProposal, PlaybackOverlayInput, PlaybackOverlayResult } from "./playback/playbackOverlay.types";
export { useMutedSegments, NO_MUTED_SEGMENTS } from "./playback/useMutedSegments";
export { usePostCreditsClaim } from "./playback/usePostCreditsClaim";
export { buildTrickplayTileUrl } from "./jellyfin/trickplayUrl";
// Library language/subtitle preferences
export {
  useLibraryPreferences, useLibraryPreference, useSetLibraryPreference, useDeleteLibraryPreference, useResolveMediaTracks,
  useInterfaceLanguage, useSetInterfaceLanguage, fetchInterfaceLanguage, setPreferencesBackendUrl, setPreferencesToken,
  tentacleApiFetch, TentacleApiError, type LibraryPreference, type TrackResolution,
  // Langues retenues par contenu (film, épisode) — prioritaires sur la série et la bibliothèque
  useItemTrackPreference, useSetItemTrackPreference, useDeleteItemTrackPreference, type ItemTrackPreference,
} from "./hooks/usePreferences";

// Support tickets
export {
  useCreateTicket, useMyTickets, useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus, useCloseTicket,
  useDeleteTickets, setTicketsBackendUrl, type SupportTicket, type TicketMessage, type TicketsPage,
} from "./hooks/useTickets";

// Notifications
export {
  useNotifications, useUnreadCount, useMarkAllRead, useMarkRead, useDeleteNotification, useDeleteNotifications,
  useDeleteAllNotifications, setNotificationsBackendUrl, type AppNotification,
} from "./hooks/useNotifications";

// Notification route resolution
export { resolveNotificationRoute, type NotifPluginMeta } from "./utils/notificationRoute";
export { EXTENSIONS_TAB_PATH, extensionSectionId, parseExtensionSectionId, extensionSectionHref } from "./utils/extensionSection";
export { isPluginActive, isVigieActive, isVigieRecoAvailable, SEER_PLUGIN_ID, type PluginPresence } from "./utils/pluginPresence";
export { formatNotifTitle, notifBodyText, parseTicketNotifBody, type NotifTranslate } from "./utils/notificationText";
export { useNotificationsLive, NOTIFICATION_LIVE_KEYS } from "./hooks/useNotificationsLive";
export {
  TICKET_STATUSES, TICKET_CATEGORIES, TICKET_STATUS_LABEL_KEYS, TICKET_STATUS_FILTER_KEYS,
  TICKET_CATEGORY_LABEL_KEYS, isTicketStatus, type TicketStatus, type TicketCategory,
} from "./utils/ticketMeta";

// Push notifications (mobile)
export {
  useRegisterPushDevice, usePushPreferences, useSetPushPreferences, useSendTestPush, setPushBackendUrl, setPushToken,
  PUSH_PREF_DEFAULTS, type PushPreferences, type TestPushResult,
} from "./hooks/usePushNotifications";

// WebSocket real-time home updates
export { useHomeWebSocket, setWsBackendUrl } from "./hooks/useHomeWebSocket";

// Socket Tentacle partagé (multiplexé : home, notifications, Watch Together)
export {
  acquireSocket, sendSocketMessage, subscribeSocket, onSocketStatus,
  getSocketStatus, sampleClock, setClockSampling, type SocketStatus,
} from "./socket/tentacleSocket";
export { getClockOffsetMs, getClockRttMs } from "./socket/clockSync";

// Canal de session : la télémétrie de lecture et la télécommande Jellyfin
// passent par le backend (opt-in de l'hôte — web, bureau et mobile)
export {
  configureSessionChannel, getChannelStatus, isChannelReporting, onChannelStatus,
  onSessionCommand, onSessionGeneral, onSessionMessage,
  type ChannelStatus, type SessionCommand, type SessionGeneral, type SessionMessage,
} from "./socket/sessionChannel";

// La télécommande appliquée au lecteur (commande Jellyfin → geste), la même
// traduction pour le web, le bureau et le mobile.
export {
  useSessionRemoteTarget, REMOTE_REWIND_SECONDS, REMOTE_FAST_FORWARD_SECONDS, type SessionRemoteTarget,
} from "./hooks/useSessionRemote";

// Le retour d'une commande du tableau de bord des sessions, de l'appui à
// l'effet constaté — le même pour le web et le mobile.
export { useCommandFeedback, type CommandFeedbackApi } from "./hooks/useCommandFeedback";

// Mesure du débit réel (téléchargement témoin Jellyfin BitrateTest) — sert le
// cap automatique de qualité des clients TV.
export { primeBitrateMeasure, cachedBitrate, measureBitrate } from "./jellyfin/bitrateMeasure";

// Watch Together (REST : composition du groupe + utilisateurs invitables)
export {
  fetchMyGroup, fetchMyInvites, createGroup, sendGroupInvites, respondToInvite,
  leaveGroup, kickGroupMember, useInvitableUsers, setWatchTogetherBackendUrl, WtApiError,
} from "./hooks/useWatchTogetherApi";

// Share link ("Partager ma liste")
export {
  useCreateShareLink, useMyShareLink, useRevokeShareLink, useSharedListView, useSharedItem,
  setShareLinkBackendUrl, setShareLinkToken, type SharedListData, type SharedListItem, type ShareListKind,
} from "./hooks/useShareLink";

// Batch remove
export { useBatchRemoveFavorites, useBatchRemoveWatchlist } from "./hooks/useBatchRemove";

// Batch watched toggle
export { useBatchWatchedToggle } from "./hooks/useBatchWatchedToggle";

// Cache utilities for cross-platform state sync
export {
  invalidateSeriesWatchViews, invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot, patchSeriesIdSet,
  type CacheTarget,
} from "./hooks/cacheUtils";
export { retireSeriesFromWatchlistIfFullyWatched, WATCHLIST_SERIES_IDS_KEY, FAVORITE_SERIES_IDS_KEY } from "./hooks/watchlistEffects";
export { forgetAutoRetired, recordAutoRetired } from "./hooks/watchlistAutoRetired";

// App config & feature flags
export { useAppConfig, useAutoplayConfig, setConfigBackendUrl, type AppConfig, type AppFeatures, type AutoplayConfig } from "./hooks/useConfig";

// Direct streaming config
export {
  useStreamingConfig, fetchStreamingConfig, setStreamingConfigBackendUrl, STREAMING_CONFIG_QUERY_KEY, type StreamingConfig,
} from "./hooks/useStreamingConfig";

// Device pairing (local/backend)
export {
  useGeneratePairingCode, usePairingStatus, useClaimPairingCode, usePairedDevices, useRevokePairedDevice, useGenerateTvToken,
  useMyPairedDevices, useRevokeMyDevice, useDevicePairGenerate, useDevicePairStatus, useDevicePairConfirm,
  setPairingBackendUrl, setPairingToken, type PairingCodeResponse, type PairingStatusResponse, type ClaimResponse,
  type PairedDevice, type TvTokenResponse, type DevicePairGenerateResponse, type DevicePairStatusResponse,
} from "./hooks/usePairing";

// Device pairing (relay)
export {
  useRelayGenerate, useRelayStatus, useRelayConfirm,
  type RelayGenerateResponse, type RelayStatusResponse, type RelayConfirmPayload,
} from "./hooks/useRelayPairing";

// Storage abstraction for cross-platform support
export { WebStorageAdapter, WebUuidGenerator, type StorageAdapter, type UuidGenerator } from "./storage";
export { TentacleConfigContext, useTentacleConfig, type TentacleConfig } from "./context";

// Watch state & continue watching
export { useSeriesWatchState, useContinueWatching, type NextEpisodeResult } from "./hooks/useWatchState";

// App mode (standalone vs backend)
export { AppModeProvider, useAppMode, type AppMode, type AppModeProviderProps } from "./appMode";

// Persistance du cache TanStack Query (cold start instantané sur la home)
export {
  hydrateQueryClient, attachQueryPersister, HOME_PERSIST_WHITELIST, type PersistStorage, type PersisterOptions,
} from "./persist/queryPersister";

// Mode économie de données — poussé par l'app (cf. net/dataSaver)
export {
  isDataSaverActive, setDataSaverActive, subscribeDataSaver, homeLimits, staleFactor, imageBudget, localReportMode,
  type HomeLimits, type ImageBudget, type LocalReportMode,
} from "./net/dataSaver";

// Politique réseau — timeout par tentative + suspicion de panne (cf. net/requestPolicy)
export { requestTimeoutMs, setRequestTimeoutMs, setNetworkSuspectListener, setOfflineHintSupplier } from "./net/requestPolicy";

// Notes explicites du moteur de recommandation (cf. hooks/useRatings)
export {
  useMyRatings, useItemRating, useRateItem, useDeleteRating, ratingKey,
  type RatingIdentity, type RatingMediaType, type UserRatingEntry, type RateItemInput,
} from "./hooks/useRatings";
export { useEndCardRating, type EndCardRating } from "./hooks/useEndCardRating";
// Notes d'épisodes : identité, notes TMDB par saison, index des notes du compte
export {
  episodeRatingIdentity, episodeRatingsIndex, useMyEpisodeRatings, useTmdbSeasonEpisodes, TMDB_SEASON_KEY,
  type TmdbEpisodeRating,
} from "./hooks/useEpisodeRatings";

// Feedback, démarrage à froid, relance du profil (cf. hooks/useRecoRows)
export {
  useSendRecoFeedback, useColdStartTitles, useRecoWarmup,
  type RecoState, type RecoReason, type RecoRowItem, type RecoFeedbackAction, type ColdStartTitle,
} from "./hooks/useRecoRows";
export type { RecoProviderRef } from "./hooks/recoTypes";

// La page de recommandations en UNE requête, et son fil temps réel
// (cf. hooks/useRecoPage, hooks/useRecoLive)
export {
  usePreferencesLive, applyPreferencesUpdate, catchUpPreferences, PREFERENCES_LIVE_SCOPES, type UsePreferencesLiveOptions,
} from "./hooks/usePreferencesLive";
export {
  useRecoPage, prefetchRecoPage, removeRecoItem, dropRecoItemEverywhere, invalidateRecoQueries, normalizeProviderFilter,
  recoFilterKey, getRecoPageKey, RECO_PAGE_KEY, ALL_PROVIDERS_KEY, type RecoPage, type RecoPageRow,
} from "./hooks/useRecoPage";
export { useRecoLive } from "./hooks/useRecoLive";

// Images, titres et état TMDB des recommandations, partagés par les clients
// (cf. reco/recoImages, reco/recoRowTitles, hooks/useAdminMetadata)
export {
  recoPosterUrl, recoHaloSourceUrl, recoBackdropUrl, recoAmbilightSourceUrl, type TmdbPosterSize, type TmdbBackdropSize,
} from "./reco/recoImages";
export { RECO_ROW_TITLE_KEYS, recoRowTitle, type RecoRowTitle } from "./reco/recoRowTitles";
export { useAdminMetadataStatus, ADMIN_METADATA_KEY, type AdminMetadataStatus } from "./hooks/useAdminMetadata";

// Personnes aimées — rangées « Avec {acteur} » (cf. hooks/useLikedPeople)
export {
  useLikedPeople, useLikePerson, useUnlikePerson, usePersonSearch, usePersonSuggestions,
  type LikedPerson, type PersonSearchResult,
} from "./hooks/useLikedPeople";

// Accueil configurable + réglages de recommandation (cf. hooks/useHomeLayout)
export {
  useHomeLayout, useSaveHomeLayout, useRecoSettings, useSaveRecoSettings, useResetTasteProfile,
  HOME_LAYOUT_KEY, RECO_SETTINGS_KEY, HOME_LAYOUT_SAVE_KEY, RECO_SETTINGS_SAVE_KEY,
  fetchHomeLayout, fetchRecoSettings, putHomeLayout, putRecoSettings,
  type HomeLayoutInput, type HeroMode, type CardDensity, type HomeRowDescriptor, type HomeLayoutData, type RecoSettingsData,
} from "./hooks/useHomeLayout";
// Sauvegardes lire-avant-d'écrire (cf. hooks/usePreferencesPatch)
export {
  useSaveHomeLayoutPatch, useSaveRecoSettingsPatch, useSaveRecoProviderFilter,
  HOME_LAYOUT_PATCH_KEY, RECO_SETTINGS_PATCH_KEY, RECO_FILTER_PATCH_KEY,
} from "./hooks/usePreferencesPatch";
export {
  applyHomeLayoutPatch, applyRecoSettingsPatch, toHomeLayoutBody, pushHomeLayoutPatch, pushRecoSettingsPatch,
  type HomeLayoutPatch, type RecoSettingsPatch, type PatchIo,
} from "./utils/preferencesPatch";
// La réconciliation des rangées de l'accueil, PURE et partagée par le web, le
// mobile et la TV (cf. utils/homeRows)
export {
  reconcileHomeRows, visibleHomeRows, isHomeRowAvailable, mergeHiddenHomeRows, firstServedRecoRowKey, moveRow,
  type LibraryRef, type ReconcileHomeRowsOptions,
} from "./utils/homeRows";

// Annuaire des plateformes de streaming (cf. hooks/useWatchProviders)
export {
  useWatchProviders, prefetchWatchProviders, WATCH_PROVIDERS_KEY, type WatchProviderDirectory, type WatchProviderEntry,
} from "./hooks/useWatchProviders";

// Reco partagés entre web, mobile et TV : raisons verbalisées, tirage des
// diapositives héros, catalogue des familles de plateformes (cf. src/reco).
export { reasonToText, type ReasonTranslate } from "./reco/recoReasonText";
export { selectHeroSlides, heroSelectionFromRows, useRecoHeroSlides, type RecoHeroSelection } from "./reco/recoHeroSlides";
export { buildPlatformCatalog, isFamilyActive, toggleFamily, activeFamilyCount, type PlatformCatalogEntry } from "./reco/platformCatalog";

// Comptes externes — TMDB guest session (cf. hooks/useExternalAccounts)
export {
  useExternalAccounts, useCreateTmdbGuestSession, useUnlinkTmdbGuestSession, useResyncRatings,
  type ExternalAccountsStatus,
} from "./hooks/useExternalAccounts";
