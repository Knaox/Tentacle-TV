/**
 * Octave mobile — les PAGES d'Octave (axe m3) : ce que la coquille inscrit dans
 * ses routes (`/octave`, `/octave/search`, `/octave/library`,
 * `/octave/album/[id]`, `/octave/artist/[id]`, `/octave/mood/[id]`), l'hôte des
 * feuilles et des avis ; le lecteur est celui de l'axe m2 (`useOptionalOctavePlayer`).
 */
export { OctaveHomeScreen } from "./home/OctaveHomeScreen";
export { OctaveSearchScreen } from "./search/OctaveSearchScreen";
export { OctaveLibraryScreen } from "./library/OctaveLibraryScreen";
export { OctaveAlbumScreen } from "./entity/OctaveAlbumScreen";
export { OctaveArtistScreen } from "./entity/OctaveArtistScreen";
export { OctaveMoodScreen } from "./entity/OctaveMoodScreen";
export { OctavePagesHost } from "./actions/OctavePagesHost";
export { openTrackSheet, closeTrackSheet, type TrackSheetRequest } from "./actions/trackSheetStore";
export { usePagesPlayer, usePagesCurrentKey } from "./env/pagesPlayer";
export { showNotice } from "./env/notices";
export { useMobileActionsUi, useMobileTrackActions } from "./env/useMobileActionsUi";
export { useOctavePagesProvider, useDeviceStore, useOctaveOwner, useArtworkResolver } from "./env/pagesEnv";
export { Artwork } from "./ui/Artwork";
export { LibraryPlaylistArtwork, PlaylistArtwork } from "./ui/PlaylistArtwork";
export { TrackRow, TRACK_ROW_HEIGHT } from "./ui/TrackRow";
