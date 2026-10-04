/**
 * Les applicateurs du lecteur sur Apple TV — ils appliquent les règles de
 * tv-core (`player/`), ils ne décident pas (`docs/tv-navigation/lecteur.md`).
 */
export { PlayerBackground } from "./PlayerBackground";
export { PLAYER_GROUP_CONTAINERS, PlayerFocusStateProvider, type PlayerFocusState } from "./playerFocusContainers";
export { END_EXIT_LOCK, withExitLock, withPreferredFocus } from "./playerFocusBindings";
export { restoreOverlayFocus } from "./overlayFocusRestore";

/** L'habillage effacé reste MONTÉ, transparent : tvOS ne focalise pas ce qui
 *  ne se voit pas, et la mémoire native du dernier bouton (`autoFocus` du
 *  guide `player:osd`) vit dans ses vues. */
export const CHROME_UNMOUNTS_WHEN_HIDDEN = false;
