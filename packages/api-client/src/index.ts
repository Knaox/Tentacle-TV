export { JellyfinClient, JellyfinError } from "./jellyfin";
export { JellyfinClientContext, useJellyfinClient } from "./hooks/useJellyfinClient";
export { useLibraries, useLibraryItems, useSeasons, useEpisodes, useMediaItem, useSimilarItems, useSearchItems } from "./hooks/useLibrary";
export { useResumeItems, useLatestItems, useNextUp, useWatchedItems, useFeaturedItems } from "./hooks/useHome";
export { useStream } from "./hooks/useStream";
export { useAuth } from "./hooks/useAuth";
export { usePlaybackReporting } from "./hooks/usePlayback";
export { useEpisodeNavigation } from "./hooks/useEpisodeNavigation";
export type { EpisodeNavigation } from "./hooks/useEpisodeNavigation";
export { useSeerrSearch, useSeerrRequest, useSeerrDeleteRequest, useSeerrRetryRequest, useSeerrDiscover, useSeerrRequests, useSeerrRequestCount, setSeerrBackendUrl } from "./hooks/useSeerr";
export type { SeerrSearchResult, SeerrSearchResponse, SeerrPagedResponse, SeerrMediaRequest, SeerrRequestsResponse } from "./hooks/useSeerr";

// Media request system
export { useRequestMedia, useMyRequests, useAllRequests, useCancelRequest, useRetryRequest, setRequestsBackendUrl } from "./hooks/useRequests";
export type { MediaRequest, RequestsPage } from "./hooks/useRequests";

// Library language/subtitle preferences
export { useLibraryPreferences, useLibraryPreference, useSetLibraryPreference, useDeleteLibraryPreference, useResolveMediaTracks, setPreferencesBackendUrl } from "./hooks/usePreferences";
export type { LibraryPreference, TrackResolution } from "./hooks/usePreferences";

// Support tickets
export { useCreateTicket, useMyTickets, useAllTickets, useTicketDetail, useReplyTicket, useUpdateTicketStatus, setTicketsBackendUrl } from "./hooks/useTickets";
export type { SupportTicket, TicketMessage, TicketsPage } from "./hooks/useTickets";

// Notifications
export { useNotifications, useUnreadCount, useMarkAllRead, useMarkRead, setNotificationsBackendUrl } from "./hooks/useNotifications";
export type { AppNotification } from "./hooks/useNotifications";

// Storage abstraction for cross-platform support
export type { StorageAdapter, UuidGenerator } from "./storage";
export { WebStorageAdapter, WebUuidGenerator } from "./storage";
export { TentacleConfigContext, useTentacleConfig } from "./context";
export type { TentacleConfig } from "./context";
