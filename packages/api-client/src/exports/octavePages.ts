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
  useMusicAlbumEntity, useMusicArtistEntity, externalEntityKey, externalEntityRef, isFromMusicProvider, type MusicEntityState,
} from "../music/octave/useMusicEntities";
export { useRecordMusicVisit, useSearchHomeSnapshot } from "../music/octave/useSearchMemory";
