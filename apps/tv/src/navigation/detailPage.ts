import type { DetailPage } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "./types";

type AnyRoute = { name: string; params?: object };

/**
 * La page de DÉTAIL que montre une route de la pile — la fiche d'un titre,
 * la page d'une personne —, ou rien (la règle de la suite de fiches,
 * `detailMove` de tv-core).
 */
export function detailPageOf(route: AnyRoute | undefined): DetailPage {
  if (!route) return null;
  if (route.name === "MediaDetail") {
    const { itemId } = route.params as RootStackParamList["MediaDetail"];
    return { kind: "title", id: itemId };
  }
  if (route.name === "SearchBrowse") {
    const params = route.params as RootStackParamList["SearchBrowse"];
    return params.kind === "person" && params.id ? { kind: "person", id: params.id } : null;
  }
  return null;
}
