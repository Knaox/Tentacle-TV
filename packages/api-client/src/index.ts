export { JellyfinClient, JellyfinError } from "./jellyfin";
export { JellyfinClientContext, useJellyfinClient } from "./hooks/useJellyfinClient";
export { useLibraries, useLibraryItems, useSeasons, useEpisodes, useMediaItem, useSimilarItems, useSearchItems } from "./hooks/useLibrary";
export { useResumeItems, useLatestItems, useNextUp, useWatchedItems, useFeaturedItems } from "./hooks/useHome";
export { useStream } from "./hooks/useStream";
export { useAuth } from "./hooks/useAuth";
export { usePlaybackReporting } from "./hooks/usePlayback";
export { useSeerrSearch, useSeerrRequest, useSeerrDeleteRequest, useSeerrRetryRequest, useSeerrDiscover, useSeerrRequests, useSeerrRequestCount, setSeerrBackendUrl } from "./hooks/useSeerr";
export type { SeerrSearchResult, SeerrSearchResponse, SeerrPagedResponse, SeerrMediaRequest, SeerrRequestsResponse } from "./hooks/useSeerr";

// Media request system
export { useRequestMedia, useMyRequests, useAllRequests, useCancelRequest, useRetryRequest, setRequestsBackendUrl } from "./hooks/useRequests";
export type { MediaRequest, RequestsPage } from "./hooks/useRequests";

// Library language/subtitle preferences
export { useLibraryPreferences, useLibraryPreference, useSetLibraryPreference, useDeleteLibraryPreference, useResolveMediaTracks, setPreferencesBackendUrl } from "./hooks/usePreferences";
export type { LibraryPreference, TrackResolution } from "./hooks/usePreferences";

// Storage abstraction for cross-platform support
export type { StorageAdapter, UuidGenerator } from "./storage";
export { WebStorageAdapter, WebUuidGenerator } from "./storage";
export { TentacleConfigContext, useTentacleConfig } from "./context";
export type { TentacleConfig } from "./context";
