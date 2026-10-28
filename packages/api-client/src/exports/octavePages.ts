// Octave — les crochets des PAGES (accueil, ambiances, recherche, album, artiste), sans DOM : web large, web
// étroit et mobile les lisent ; chaque application passe son extension, son stockage et ses pochettes.
export { noArtworkPreload, type ArtworkPreloader } from "../music/octave/artworkPort";
export { ownedAlbums, ownedCount, ownedTracks, searchAlbumOwnership, type AlbumOwnership, type ShownAlbum } from "../music/octave/ownedItems";
export { matchInputOf, ownedLists, useOwnedLists, type OwnedLists } from "../music/octave/ownedSearch";
export { useOctaveSearch, settledQuery, type OctaveSearchLabels } from "../music/octave/useOctaveSearch";
export { useRevealedResults, useArtReady, type RevealedResultsOptions, type ShownExternal } from "../music/octave/useRevealedResults";
export { useKindResults, type KindResults } from "../music/octave/useKindResults";
export { useOctaveSuggestions, SUGGEST_DEBOUNCE_MS } from "../music/octave/useOctaveSuggestions";
export { useMusicMoods, useMusicMoodMix, useMusicMoodTracks, moodLanguage, moodContextId } from "../music/octave/useMusicMoods";
export {
  useMusicAlbumEntity, useMusicArtistEntity, useMusicExternalPlaylist, externalEntityKey, externalEntityRef, type MusicEntityState,
} from "../music/octave/useMusicEntities";
export { prefetchExternalEntity, warmVisibleAlbums, warmModeOf, takeIntentSlot, INTENT_PER_MINUTE } from "../music/octave/entityWarmup";
export { useAlbumWarmup, type AlbumWarmup } from "../music/octave/useAlbumWarmup";
export { useRecordMusicVisit, useSearchHomeSnapshot } from "../music/octave/useSearchMemory";
// Octave — les GESTES sur un titre (cœur, playlists, droits d'ajout), et leurs magasins d'interface.
export type { OctaveActionsUi, MusicTranslate, ActionNoticeKind, ActionNoticeOptions } from "../music/octave/actions/actionsUi";
export { setLikeOverride, clearLikeOverride, likeOverrideOf, resetLikeOverrides, useLiked } from "../music/octave/actions/likeOverrides";
export {
  chooserSnapshot, subscribeChooser, openPlaylistChooser, openPlaylistChooserForMany, closePlaylistChooser, type ChooserRequest,
} from "../music/octave/actions/playlistChooserStore";
export {
  unavailableAlbumSnapshot, subscribeUnavailableAlbum, openUnavailableAlbum, closeUnavailableAlbum,
} from "../music/octave/actions/unavailableAlbumStore";
export { askDuplicate, answerDuplicate, useDuplicateAsk, type DuplicateAsk } from "../music/octave/actions/duplicateAsk";
export { LAST_PLAYLIST_KEY, lastPlaylistIdFrom, rememberPlaylistIn, quickTarget } from "../music/octave/actions/lastPlaylist";
export { mayOfferAcquire, quotaExhausted, remainingToTell } from "../music/octave/actions/acquireRules";
export { useAcquireRights, type AcquireRights } from "../music/octave/actions/useAcquireRights";
export { usePlaylistGestures, isLibraryTrack, type PlaylistGestures } from "../music/octave/actions/usePlaylistGestures";
export { useTrackActions, type TrackActions } from "../music/octave/actions/useTrackActions";
export { useAlbumOwnership, type AlbumLibraryOwnership } from "../music/octave/useAlbumOwnership";
export { useOwnedAlbums } from "../music/octave/useOwnedAlbums";
export { useOwnedTracks } from "../music/octave/useOwnedTracks";
