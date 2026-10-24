// Octave — les points d'extension musique, génériques (rien de nommé) :
// fournisseur, recherche progressive fusionnée, source, anticipation, gestes,
// en attente, événements `music:*`.
export { findMusicProvider, musicRouteUrl, musicSectionLabel, type MusicProvider } from "../pluginMusic/musicProvider";
export { mergeExternalMusicPages, readMusicSearchPage, type MergedMusicResults } from "../pluginMusic/musicSearchMerge";
export {
  resolveMusicSources, isSourceFresh, prefetchMusic, likeExternalTrack, addExternalTrackToPlaylist, fetchPendingMusic,
} from "../pluginMusic/musicRequests";
export { useMusicProvider } from "../pluginMusic/useMusicProvider";
export { useMusicSearch, type MusicSearchOptions, type MusicSearchState } from "../pluginMusic/useMusicSearch";
export {
  useMusicResolver, useMusicPrefetch, useMusicGestures, useMusicPending, musicPendingKey, type MusicGestures,
} from "../pluginMusic/useMusicActions";
export { useMusicEvents, applyMusicEvent, isMusicEvent, type UseMusicEventsOptions } from "../pluginMusic/useMusicEvents";
