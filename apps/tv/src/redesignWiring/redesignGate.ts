import type { RootStackParamList } from "../navigation/types";

/**
 * L'aiguillage de la refonte de l'UI TV — le SEUL endroit qui dit si elle est
 * active. Chaque écran branché le lit, au niveau de l'écran :
 *
 *   export function XScreen(props: Props) {
 *     return REDESIGN_ACTIVE ? <XRedesign {...props} /> : <LegacyXScreen {...props} />;
 *   }
 *
 * L'ancien corps reste dans le fichier de l'écran ; le branchement de la
 * refonte vit dans `redesignWiring/<écran>/`. Jamais d'aiguillage dans la
 * logique partagée (hooks de données, tv-core, api-client) : elle sert les deux.
 *
 * Apple TV et Android TV : oui (bascule d'Android le 2026-10-05, lot A5).
 * L'aiguillage reste le temps de retirer les anciens corps, écran par écran.
 */
export const REDESIGN_ACTIVE: boolean = true;

type RouteName = keyof RootStackParamList;

/**
 * Les routes dont l'écran rend la refonte AVEC SA NAVIGATION : chaque vue
 * refondue rend son propre `NavRail` (prop `nav`), si bien que le rail actuel
 * — monté une fois, à côté du navigateur (`TVNavChrome`) — s'efface sur elles.
 * Un écran branché ajoute sa route ici, une ligne chacun. Vide tant qu'aucun
 * écran n'est branché : l'app reste alors exactement celle d'avant.
 */
const ROUTES: readonly RouteName[] = [
  "Settings",
  "Home",
  "Recommendations",
  "Library",
  "Watchlist",
  "Favorites",
  "SearchBrowse",
  "Search",
];

export const REDESIGN_ROUTES: ReadonlySet<string> = new Set<string>(REDESIGN_ACTIVE ? ROUTES : []);
