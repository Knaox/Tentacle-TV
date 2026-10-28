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
export { useAlbumNotes } from "../music/useAlbumNotes";
export { useMusicSearch, useDebouncedText, musicSearchText, type MusicSearchOptions } from "../music/useMusicSearch";
export { useMusicLiked, useToggleMusicFavorite, patchFavorites, MUSIC_LIKED_PAGE } from "../music/useMusicFavorite";
export {
  useMusicPlaylists, useMusicPlaylist, useMusicPlaylistReader, useAddToMusicPlaylist, useMoveMusicPlaylistEntry, useRemoveMusicPlaylistEntry,
  useRenameMusicPlaylist, useCreateMusicPlaylist, useDeleteMusicPlaylist, useUpdateMusicPlaylistDetails, useDuplicateMusicPlaylist, duplicateInBatches,
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
// Octave — une liste affichée (playlist, « Titres likés ») : tri du compte, recherche, filtre, glisser.
export { useListOrder, type ListOrderOptions, type ReorderBlock } from "../music/lists/useListOrder";
export { useWholeLiked } from "../music/lists/useWholeLiked";
// Octave — partager une playlist par un lien (capacité `music.playlistShare`, droit « Partage public »).
export { useMusicPlaylistShare, useMusicPlaylistShareAvailable, useMusicShareLinkImport, playlistShareShown, musicShareApi, musicShareKey } from "../music/useMusicPlaylistShare";
// Octave — l'import de sorties hors catalogue (point `releases` du contrat music : lien Bandcamp, fichiers).
export { useReleaseImport, useImportedReleases, releaseSourcesOf, releasePortFor, importedReleasesKey, releaseImportState, subscribeReleaseImport, type ReleaseImportHandle } from "../music/releases/useReleaseImport";
export { runReleaseFiles, runReleaseLink, RELEASE_RETRY_DELAYS_MS, type ReleaseFlowState, type ReleaseLocalFile, type ReleasePhase, type ReleasePort } from "../music/releases/releaseFlow";
export { ReleaseRequestError, toReleaseError } from "../music/releases/releaseRequests";
export { classifyPasted, importFraction, arrivingShareLink, type PastedImport } from "../music/import/importEntry";
// Octave — les pages gardées sur l'appareil, communes au web et au mobile (le stockage est un port).
export * from "../music/octaveCache";
export { useOctaveAvailability, octaveAvailabilityOf, type OctaveAvailability, type OctaveAvailabilityInput } from "../music/useOctaveAvailability";
export { useLibraryFirstRows } from "../music/lists/useLibraryFirstRows";
// Octave — gérer une playlist et en retirer des titres, avec l'interface de l'application (web, mobile).
export { usePlaylistRemoval, type PlaylistTarget } from "../music/octave/playlists/usePlaylistRemoval";
export { usePlaylistManageGestures, type PlaylistManageHooks } from "../music/octave/playlists/usePlaylistManageGestures";
// Octave — la file d'une session musique sur un moteur, la même pour le web, le bureau et le mobile.
export { buildOctavePlayer, isFromMusicProvider, type OctaveKeptPort } from "../music/player/buildOctavePlayer";
export { followSearchWithRadio, RADIO_REFILL_AT, RADIO_MISSES_MAX } from "../music/player/searchRadio";
export { attachPlayerResume, readSavedPlayback, OCTAVE_PLAYER_KEY, type PlayerResumeDeps } from "../music/player/playerResume";
export { applyOctaveEvent } from "../music/octave/events/octaveEventEffects";
