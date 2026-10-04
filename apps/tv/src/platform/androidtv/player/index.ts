/**
 * Les applicateurs du lecteur sur ANDROID TV — le jumeau de
 * `platform/tvos/player`, aux MÊMES noms ; ils appliquent les règles de
 * tv-core (`player/`), ils ne décident pas (`docs/tv-navigation/lecteur.md`,
 * « Android TV »).
 *
 * Repris tels quels de l'Apple TV, parce que react-native-tvos les sert à
 * l'identique sur Android : le FOND (`TouchableOpacity` focalisable, préféré),
 * et les GUIDES de l'habillage (`TVFocusGuideView` : `autoFocus`,
 * `destinations`, `trapFocus*` sont implémentés par `ReactViewGroup`).
 * Propres à Android : la croix verrouillée (`tvFocusable`, pas
 * `isTVSelectable`) et l'habillage effacé qui se démonte.
 */
export { PlayerBackground } from "../../tvos/player/PlayerBackground";
export { PLAYER_GROUP_CONTAINERS, PlayerFocusStateProvider, type PlayerFocusState } from "../../tvos/player/playerFocusContainers";
export { END_EXIT_LOCK, withExitLock, withPreferredFocus } from "./playerFocusBindings";

/**
 * L'habillage effacé se DÉMONTE : le moteur de focus d'Android ne tient pas
 * compte de la transparence — un bouton à opacité 0 reste atteignable depuis
 * le fond — et une vue cachée coûte encore ses rendus (la frise suit la
 * lecture chaque seconde).
 */
export const CHROME_UNMOUNTS_WHEN_HIDDEN = true;
