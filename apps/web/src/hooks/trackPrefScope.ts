/**
 * Ce que la résolution EN LIGNE des pistes demande au serveur
 * (`POST /api/preferences/resolve`), et dans quel ordre.
 *
 * Le serveur s'arrête au premier niveau trouvé : le contenu (`itemId`), puis
 * `libraryId`, puis `libraryIds` dans l'ordre d'envoi. Sans série cochée, on
 * lui envoie donc le contenu, la saison, la série, les ancêtres — l'ordre
 * d'avant. Quand « Appliquer à cette série » est cochée, la série doit
 * l'emporter sur le choix propre à l'épisode et sur la saison : on ne lui
 * envoie QUE la série, sans `itemId`. Aucun serveur à mettre à jour.
 */

import type { MediaItem } from "@tentacle-tv/shared";

/** `pending` : on ne sait pas encore si la série a sa préférence. */
export type SeriesPrefState = "pending" | "none" | "set";

export interface ResolveScope {
  libraryId: string;
  libraryIds: string[];
  /** Absent quand la série l'emporte. */
  itemId?: string;
}

/** La série d'un épisode ; rien pour un film. */
export function seriesIdOf(item: Pick<MediaItem, "Type" | "SeriesId"> | undefined): string | undefined {
  return item?.Type === "Episode" ? item.SeriesId ?? undefined : undefined;
}

/**
 * L'état de la préférence de série d'après sa requête. Une requête en échec
 * (serveur d'avant qui répond 404, panne) vaut « aucune » : la résolution
 * n'attend jamais indéfiniment.
 */
export function seriesPrefStateOf(
  seriesId: string | undefined,
  query: { data: unknown; isError: boolean; isFetching: boolean },
): SeriesPrefState {
  if (!seriesId) return "none";
  if (query.data) return "set";
  if (query.isError || !query.isFetching) return "none";
  return "pending";
}

/** `null` : aucun niveau à interroger (le client garde les pistes par défaut). */
export function resolveScopeOf(
  item: Pick<MediaItem, "Id" | "Type" | "SeriesId" | "ParentId">,
  ancestorIds: readonly string[],
  seriesPref: SeriesPrefState,
): ResolveScope | null {
  const seriesId = seriesIdOf(item);
  if (seriesId && seriesPref === "set") return { libraryId: seriesId, libraryIds: [seriesId] };
  const candidates = [...new Set([item.ParentId, item.SeriesId, ...ancestorIds].filter(Boolean))] as string[];
  const first = candidates[0];
  if (first === undefined) return null;
  return { libraryId: first, libraryIds: candidates, itemId: item.Id };
}
