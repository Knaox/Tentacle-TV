/**
 * Les applicateurs du lecteur sur Apple TV — ils appliquent les règles de
 * tv-core (`player/`), ils ne décident pas (`docs/tv-navigation/lecteur.md`).
 */
export { PlayerBackground } from "./PlayerBackground";
export { PLAYER_GROUP_CONTAINERS, PlayerFocusStateProvider, type PlayerFocusState } from "./playerFocusContainers";
export { END_EXIT_LOCK, withExitLock, withPreferredFocus } from "./playerFocusBindings";
export { restoreOverlayFocus } from "./overlayFocusRestore";
