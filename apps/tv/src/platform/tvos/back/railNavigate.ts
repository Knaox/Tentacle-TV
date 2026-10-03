import { CommonActions } from "@react-navigation/native";
import { railStack, type RailDestination, type StackRoute } from "@tentacle-tv/tv-core";
import { navigationRef } from "../../../navigation/navigationRef";

/**
 * Aller à une page du rail (Apple TV) — l'APPLICATEUR : la pile en onglets
 * est décidée par tv-core (`nav/railStack`), posée ici d'un `reset`.
 *
 * Android TV garde `navigation/railNavigate.ts`, la même règle recopiée, le
 * temps de son portage (`docs/tv-navigation/retour-rail.md`, « À retirer au
 * portage Android TV »).
 */
export function goToRailPage(target: StackRoute): void {
  if (!navigationRef.isReady()) return;
  const routes = navigationRef.getRootState()?.routes as StackRoute[] | undefined;
  navigationRef.dispatch(CommonActions.reset(railStack(routes, target)));
}

/** La route d'une page du rail ; une bibliothèque y porte son nom (lu dans le cache des bibliothèques). */
export function railRouteOf(destination: RailDestination, libraryName: (libraryId: string) => string): StackRoute {
  if (destination.route === "Library") {
    return { name: "Library", params: { libraryId: destination.libraryId, libraryName: libraryName(destination.libraryId) } };
  }
  return { name: destination.route, params: undefined };
}
