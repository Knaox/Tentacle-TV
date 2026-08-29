export { JellyfinClient, JellyfinError } from "./jellyfin";
export type { DirectStreamingState } from "./jellyfin";
export { JellyfinClientContext, useJellyfinClient } from "./hooks/useJellyfinClient";
export { useLibraries, useLibraryItems, useSeasons, useEpisodes, useMediaItem, useItemAncestors, useSimilarItems, useCollectionItems, useGenres, useStudios } from "./hooks/useLibrary";
export { useRandomLibraryBackdrop, getLibraryBackdropKey, prefetchLibraryBackdrop } from "./hooks/useLibraryBackdrop";
export { useSearchItems } from "./hooks/useSearchItems";
export { useLibraryCatalog, getLibraryCatalogKey, prefetchLibraryCatalog } from "./hooks/useLibraryCatalog";
export type { CatalogFilters } from "./hooks/useLibraryCatalog";
export { useResumeItems, useLatestItems, useNextUp, useWatchedItems, useFeaturedItems } from "./hooks/useHome";
export { useLocalTrailers, useSpecialFeatures } from "./hooks/useTrailers";
export { useFavorite, useFavoriteForItem } from "./hooks/useFavorite";
export { useWatchlist, useToggleWatchlist, useToggleWatchlistForItem, useFavorites, useWatchlistAll, useFavoritesAll } from "./hooks/useWatchlist";
export { useWatchlistSeriesIds, useFavoriteSeriesIds, seriesStateId } from "./hooks/useSeriesListMembership";
export { useWatchedToggle } from "./hooks/useWatchedToggle";
export { useWatchStopInvalidation } from "./hooks/useWatchStopInvalidation";
export { useStream } from "./hooks/useStream";
export type { StreamOptions } from "./hooks/useStream";
export { useAuth } from "./hooks/useAuth";
export { useUserId, notifyUserChange } from "./hooks/useUserId";
export { usePlaybackReporting } from "./hooks/usePlayback";
export type { PlaybackReportingOptions } from "./hooks/usePlayback";
// Destruction d'un transcode actif, hors du hook de reporting : les filets de
// lecture renégocient une session sans en tenir un (cf. useWebPlaybackFallbacks).
export { killActiveEncoding } from "./hooks/playbackTransport";
export { useEpisodeNavigation } from "./hooks/useEpisodeNavigation";
export type { EpisodeNavigation } from "./hooks/useEpisodeNavigation";
export { useIntroSkipper, normalizeSkipSegments } from "./hooks/useIntroSkipper";
export type { SkipSegments, RawSkipSources, MediaSegmentsResponse, PluginSegmentDict, PluginTimestamps } from "./hooks/useIntroSkipper";
// Segments de lecture — le contrat résolu par le backend, les réglages
// partagés du compte, et LA coquille d'overlay des six surfaces.
export { usePlaybackSegments } from "./hooks/usePlaybackSegments";
export { usePlaybackSettings, usePlaybackSettingsStore, setPlaybackSettings, rehydratePlaybackSettings, initPlaybackSettingsStore } from "./hooks/usePlaybackSettings";
export { usePlaybackOverlay } from "./playback/usePlaybackOverlay";
export type { PlaybackOverlayInput, PlaybackOverlayResult } from "./playback/playbackOverlay.types";
export { useMutedSegments, NO_MUTED_SEGMENTS } from "./playback/useMutedSegments";
// Library language/subtitle preferences
export { useLibraryPreferences, useLibraryPreference, useSetLibraryPreference, useDeleteLibraryPreference, useResolveMediaTracks, useInterfaceLanguage, useSetInterfaceLanguage, fetchInterfaceLanguage, setPreferencesBackendUrl, setPreferencesToken, tentacleApiFetch, TentacleApiError } from "./hooks/usePreferences";
export type { LibraryPreference, TrackResolution } from "./hooks/usePreferences";
// Langues retenues par contenu (film, épisode) — prioritaires sur la série et la bibliothèque
export { useItemTrackPreference, useSetItemTrackPreference, useDeleteItemTrackPreference } from "./hooks/usePreferences";
export type { ItemTrackPreference } from "./hooks/usePreferences";

// Support tickets
export { useCreateTicket, useMyTickets, useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus, setTicketsBackendUrl } from "./hooks/useTickets";
export type { SupportTicket, TicketMessage, TicketsPage } from "./hooks/useTickets";

// Notifications
export { useNotifications, useUnreadCount, useMarkAllRead, useMarkRead, useDeleteNotification, useDeleteNotifications, useDeleteAllNotifications, setNotificationsBackendUrl } from "./hooks/useNotifications";
export type { AppNotification } from "./hooks/useNotifications";

// Notification route resolution
export { resolveNotificationRoute } from "./utils/notificationRoute";
export type { NotifPluginMeta } from "./utils/notificationRoute";

// Push notifications (mobile)
export { useRegisterPushDevice, usePushPreferences, useSetPushPreferences, useSendTestPush, setPushBackendUrl, setPushToken } from "./hooks/usePushNotifications";
export type { PushPreferences, TestPushResult } from "./hooks/usePushNotifications";

// WebSocket real-time home updates
export { useHomeWebSocket, setWsBackendUrl } from "./hooks/useHomeWebSocket";

// Socket Tentacle partagé (multiplexé : home, notifications, Watch Together)
export {
  acquireSocket, sendSocketMessage, subscribeSocket, onSocketStatus,
  getSocketStatus, getClockOffsetMs, sampleClock,
} from "./socket/tentacleSocket";
export type { SocketStatus } from "./socket/tentacleSocket";

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
  setShareLinkBackendUrl, setShareLinkToken,
} from "./hooks/useShareLink";
export type { SharedListData, SharedListItem } from "./hooks/useShareLink";

// Batch remove
export { useBatchRemoveFavorites, useBatchRemoveWatchlist } from "./hooks/useBatchRemove";

// Batch watched toggle
export { useBatchWatchedToggle } from "./hooks/useBatchWatchedToggle";

// Cache utilities for cross-platform state sync
export { invalidateAllMediaQueries, updateItemUserDataInCache, restoreFromSnapshot, patchSeriesIdSet } from "./hooks/cacheUtils";
export type { CacheTarget } from "./hooks/cacheUtils";
export { retireSeriesFromWatchlistIfFullyWatched, WATCHLIST_SERIES_IDS_KEY, FAVORITE_SERIES_IDS_KEY } from "./hooks/watchlistEffects";

// App config & feature flags
export { useAppConfig, useAutoplayConfig, setConfigBackendUrl } from "./hooks/useConfig";
export type { AppConfig, AppFeatures, AutoplayConfig } from "./hooks/useConfig";

// Direct streaming config
export { useStreamingConfig, fetchStreamingConfig, setStreamingConfigBackendUrl, STREAMING_CONFIG_QUERY_KEY } from "./hooks/useStreamingConfig";
export type { StreamingConfig } from "./hooks/useStreamingConfig";

// Device pairing (local/backend)
export { useGeneratePairingCode, usePairingStatus, useClaimPairingCode, usePairedDevices, useRevokePairedDevice, useGenerateTvToken, useMyPairedDevices, useRevokeMyDevice, useDevicePairGenerate, useDevicePairStatus, useDevicePairConfirm, setPairingBackendUrl, setPairingToken } from "./hooks/usePairing";
export type { PairingCodeResponse, PairingStatusResponse, ClaimResponse, PairedDevice, TvTokenResponse, DevicePairGenerateResponse, DevicePairStatusResponse } from "./hooks/usePairing";

// Device pairing (relay)
export { useRelayGenerate, useRelayStatus, useRelayConfirm } from "./hooks/useRelayPairing";
export type { RelayGenerateResponse, RelayStatusResponse, RelayConfirmPayload } from "./hooks/useRelayPairing";

// Storage abstraction for cross-platform support
export type { StorageAdapter, UuidGenerator } from "./storage";
export { WebStorageAdapter, WebUuidGenerator } from "./storage";
export { TentacleConfigContext, useTentacleConfig } from "./context";
export type { TentacleConfig } from "./context";

// Watch state & continue watching
export { useSeriesWatchState, useContinueWatching } from "./hooks/useWatchState";
export type { NextEpisodeResult } from "./hooks/useWatchState";

// App mode (standalone vs backend)
export { AppModeProvider, useAppMode } from "./appMode";
export type { AppMode, AppModeProviderProps } from "./appMode";

// Persistance du cache TanStack Query (cold start instantané sur la home)
export {
  hydrateQueryClient,
  attachQueryPersister,
  HOME_PERSIST_WHITELIST,
} from "./persist/queryPersister";
export type { PersistStorage, PersisterOptions } from "./persist/queryPersister";

// Mode économie de données — poussé par l'app (cf. net/dataSaver)
export {
  isDataSaverActive,
  setDataSaverActive,
  subscribeDataSaver,
  homeLimits,
  staleFactor,
  imageBudget,
  localReportMode,
} from "./net/dataSaver";
export type { HomeLimits, ImageBudget, LocalReportMode } from "./net/dataSaver";

// Politique réseau — timeout par tentative + suspicion de panne (cf. net/requestPolicy)
export {
  requestTimeoutMs,
  setRequestTimeoutMs,
  setNetworkSuspectListener,
  setOfflineHintSupplier,
} from "./net/requestPolicy";
