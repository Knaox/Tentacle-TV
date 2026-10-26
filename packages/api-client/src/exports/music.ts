// Octave : la musique de la bibliothèque Jellyfin (capacité `music.library`) —
// recherche, albums, artistes, accueil, cœur, playlists, sources, direct.
export { musicApi, type MusicAlbumSort } from "../music/musicApi";
export { MUSIC_KEY, musicKeys } from "../music/musicQueryKeys";
export { withFavorites, likedAfter, insertedEntries, movedEntries, removedEntry } from "../music/musicCachePatch";
export {
  useMusicCapability, useMusicStatus, useMusicAvailable, useMusicAlbums, useMusicAlbum, useMusicArtists,
  useMusicArtist, useMusicHome, useMusicByMbid, useMusicSource, fetchMusicSource,
} from "../music/useMusicLibrary";
export {
  useMusicLibraryMatch, libraryMatchRequest, trackMatchQuery, albumMatchQuery, type LibraryMatches, type LibraryAlbumMatch,
} from "../music/useMusicLibraryMatch";
export { useMusicSearch, useDebouncedText, musicSearchText, type MusicSearchOptions } from "../music/useMusicSearch";
export { useMusicLiked, useToggleMusicFavorite, patchFavorites, MUSIC_LIKED_PAGE } from "../music/useMusicFavorite";
export {
  useMusicPlaylists, useMusicPlaylist, useMusicPlaylistReader, useAddToMusicPlaylist, useMoveMusicPlaylistEntry, useRemoveMusicPlaylistEntry,
  useRenameMusicPlaylist, useCreateMusicPlaylist, useDeleteMusicPlaylist,
} from "../music/useMusicPlaylists";
export { useMusicLive, applyMusicEvent, type UseMusicLiveOptions } from "../music/useMusicLive";
export { reportMusicPlayback, isListenCompleted, MUSIC_COMPLETED_RATIO } from "../music/musicPlaybackReport";
// Octave — l'import d'une playlist d'un autre service (capacité `music.playlistImport`).
export { useMusicImport, importPortFor, extensionImportSources, type MusicImportHandle } from "../music/import/useMusicImport";
export { runImport, IMPORT_IDLE, type ImportFlowState, type ImportFlowFailure, type ImportPhase, type ImportSummary, type ImportUserInput, type ImportPort } from "../music/import/importFlow";
// Octave — l'ordre des listes : tri, ordre personnalisé (capacité `music.listOrder`).
export {
  musicListApi, useMusicListOrderCapability, useMusicListPrefs, useSaveMusicListPrefs, useReorderMusicPlaylist, latestWinsQueue,
} from "../music/useMusicListOrder";
