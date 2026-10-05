import type { RootStackParamList } from "../../navigation/types";

type RouteName = keyof RootStackParamList;

/**
 * Les routes dont l'écran rend la NAVIGATION (son propre `NavRail`, prop
 * `nav`) : le squelette et l'erreur d'un tel écran la gardent
 * (`ScreenSkeletonRedesign`, `ScreenErrorRedesign`). Les autres — fiche,
 * lecteur, bande-annonce, jumelage, profils — sont plein écran.
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

export const RAIL_ROUTES: ReadonlySet<string> = new Set<string>(ROUTES);
