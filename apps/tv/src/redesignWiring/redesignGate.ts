import { Platform } from "react-native";
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
 * Apple TV : oui. Android TV : pas encore en production — mais en
 * DÉVELOPPEMENT, oui quand le bundle a été construit avec
 * `TENTACLE_TV_REDESIGN=1` (Metro ou build Gradle ; c'est ce que fait
 * `pnpm tv:refonte:android`). La valeur est inlinée par Babel
 * (`babel/inlineRedesignFlag.js`) : absente — la CI, toute build livrée —,
 * Android garde l'UI actuelle. La bascule définitive retirera la condition.
 */
const ANDROID_DEV_OPT_IN = process.env.TENTACLE_TV_REDESIGN === "1";

export const REDESIGN_ACTIVE: boolean = Platform.OS === "ios" || (Platform.OS === "android" && ANDROID_DEV_OPT_IN);

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
