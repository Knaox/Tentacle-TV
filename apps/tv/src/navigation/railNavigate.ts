import { CommonActions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";
import { navigationRef } from "./navigationRef";

type PartialRoute = { key?: string; name: string; params?: object };

type RailRoute = "Home" | "Recommendations" | "Search" | "Watchlist" | "Favorites" | "Settings" | "Library";

/**
 * La navigation du rail, à la manière d'onglets : l'accueil reste la base de
 * la pile, et une destination du rail REMPLACE la précédente au-dessus de lui.
 *
 * `navigate` de React Navigation 7 ne revient plus à un écran déjà empilé : il
 * en empile une nouvelle copie. Accueil → Bibliothèque → Accueil →
 * Bibliothèque… laissait donc une pile qui ne cessait de grossir, chaque copie
 * montée avec ses requêtes, ses écouteurs et ses minuteries — rien n'en gèle
 * les écrans du dessous. Sur un boîtier Android, la navigation ralentissait au
 * fil de la soirée. Ici la pile tient en deux écrans ; l'accueil garde son
 * instance (même clé de route), les autres repartent à neuf.
 */
export function railNavigate<N extends RailRoute>(name: N, params?: RootStackParamList[N]): void {
  if (!navigationRef.isReady()) return;
  const state = navigationRef.getRootState();
  const found = state?.routes.find((route) => route.name === "Home");
  // La même clé de route : React Navigation garde l'instance montée de l'accueil.
  const home: PartialRoute | null = found ? { key: found.key, name: "Home", params: found.params as object | undefined } : null;
  if (name === "Home") {
    navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [home ?? { name: "Home" }] }));
    return;
  }
  const target: PartialRoute = { name, params: params as object | undefined };
  const routes: PartialRoute[] = home ? [home, target] : [target];
  navigationRef.dispatch(CommonActions.reset({ index: routes.length - 1, routes }));
}
