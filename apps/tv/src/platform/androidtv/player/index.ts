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
 * Propre à Android : la croix verrouillée (`tvFocusable`, pas
 * `isTVSelectable`), et les guides vides (`tvos/player/emptyGuide.android.ts`).
 */
export { PlayerBackground } from "../../tvos/player/PlayerBackground";
export { PLAYER_GROUP_CONTAINERS, PlayerFocusStateProvider, type PlayerFocusState } from "../../tvos/player/playerFocusContainers";
export { END_EXIT_LOCK, withExitLock, withPreferredFocus } from "./playerFocusBindings";

