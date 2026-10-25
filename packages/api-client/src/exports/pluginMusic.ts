// Octave — les points d'extension musique, génériques (rien de nommé) :
// fournisseur, recherche progressive fusionnée, source, anticipation, gestes,
// en attente, événements `music:*`.
export { findMusicProvider, musicRouteUrl, musicSectionLabel, type MusicProvider } from "../pluginMusic/musicProvider";
export { mergeExternalMusicPages, readMusicSearchPage, readMusicTop, type MergedMusicResults } from "../pluginMusic/musicSearchMerge";
export {
  resolveMusicSources, resolveMusicSource, type MusicSourceOutcome, isSourceFresh, prefetchMusic, likeExternalTrack, addExternalTrackToPlaylist, fetchPendingMusic,
  reportExternalPlayed, fetchExternalAlbum, fetchExternalArtist, fetchExternalPlaylist,
} from "../pluginMusic/musicRequests";
export { useMusicProvider } from "../pluginMusic/useMusicProvider";
export { useMusicSuggest, readMusicSuggestions } from "../pluginMusic/useMusicSuggest";
// Renommés à l'export : la recherche de la BIBLIOTHÈQUE (exports/music) garde les noms courts.
export {
  useMusicSearch as usePluginMusicSearch, type MusicSearchOptions as PluginMusicSearchOptions, type MusicSearchState as PluginMusicSearchState,
} from "../pluginMusic/useMusicSearch";
export {
  useMusicResolver, useMusicPrefetch, useMusicGestures, useMusicPending, musicPendingKey, type MusicGestures,
} from "../pluginMusic/useMusicActions";
export { useMusicEvents, applyMusicEvent as applyPluginMusicEvent, isMusicEvent, type UseMusicEventsOptions } from "../pluginMusic/useMusicEvents";
export { startClientFetchAgent, isClientFetchJob, type ClientFetchExecutor } from "../pluginMusic/clientFetchAgent";
export { useClientFetchAgent } from "../pluginMusic/useClientFetchAgent";
export { tentacleApiSession, type TentacleApiSession } from "../hooks/usePreferences";
