import type { MediaItem } from "../types/media";

/**
 * Ce que la carte REPRÉSENTE — et donc quelle note lui revient.
 *
 * `series` : l'affiche 2:3 et le titre sont ceux de la SÉRIE. C'est le cas des
 * rangées « Derniers ajouts », des grilles et des collections : un épisode y
 * est le visage de sa série, jamais le sien, et il en porte donc la note. Deux
 * cartes voisines de la même série affichaient sinon deux notes différentes.
 *
 * `item` : la carte EST l'item. La vignette 16:9 d'un épisode, un résultat de
 * recherche — ils portent le nom de l'épisode, ils portent sa note.
 */
export type CardRatingScope = "item" | "series";

export interface CardRating {
  /** La note à poser, `null` quand il n'y en a pas — le badge se tait dessus. */
  rating: number | null;
  /**
   * La série dont la note manque et reste à charger, `null` sinon. L'appelant
   * les rassemble (`missingSeriesRatingIds`) et les demande EN UNE FOIS.
   */
  missingSeriesId: string | null;
}

/** Une note ne vaut que si elle est positive : Jellyfin rend `0` pour « aucune ». */
function usable(rating: number | null | undefined): number | null {
  return typeof rating === "number" && rating > 0 ? rating : null;
}

/**
 * La série à laquelle une carte se rattache, ou `null` si la question n'a pas
 * de sens pour elle.
 *
 * Le même raisonnement que `seriesStateId` (`useSeriesListMembership`) : une
 * tuile de lot est SYNTHÉTIQUE — `groupLatestByRuns` la fabrique avec
 * l'identifiant de la série et `Type: "Series"`, mais sans rien d'autre. Elle
 * tombe donc dans la même branche qu'une vraie série, et il n'y a pas à lui
 * passer son nombre d'épisodes pour la reconnaître : un paramètre de plus
 * serait un paramètre qu'un appelant oublierait.
 */
function seriesIdFor(item: MediaItem, scope: CardRatingScope): string | null {
  if (item.Type === "Series") return item.Id ?? null;
  if (scope === "item") return null;
  if (item.Type === "Episode" || item.Type === "Season") return item.SeriesId ?? null;
  return null;
}

/**
 * La note d'une carte, et ce qu'il manque pour la connaître.
 *
 * `seriesRatings` est la carte des notes déjà chargées (cf. `useSeriesRatings`).
 * Sans elle, la fonction répond quand même : elle rend ce que l'item porte, et
 * dit ce qui lui manque. Une surface qui ne veut pas payer de requête peut donc
 * ignorer `missingSeriesId` — elle n'aura simplement pas de note sur les lots.
 */
export function cardRatingFor(
  item: MediaItem,
  scope: CardRatingScope = "series",
  seriesRatings?: ReadonlyMap<string, number> | null,
): CardRating {
  const seriesId = seriesIdFor(item, scope);

  // La carte ne représente aucune série : elle porte sa propre note, et n'a
  // rien à résoudre. Un film sans note s'arrête ici — c'est ce qui évite une
  // requête par affiche sur une bibliothèque mal indexée.
  if (!seriesId) return { rating: usable(item.CommunityRating), missingSeriesId: null };

  // Une vraie série porte la sienne. Une tuile de lot n'a rien. Et un ÉPISODE
  // porte la note de l'épisode — qui n'est justement pas celle qu'on cherche
  // ici : la carte montre l'affiche et le titre de la série, deux épisodes
  // voisins afficheraient sinon deux notes pour la même œuvre.
  const own = item.Type === "Series" ? usable(item.CommunityRating) : null;
  if (own !== null) return { rating: own, missingSeriesId: null };

  const known = usable(seriesRatings?.get(seriesId));
  if (known !== null) return { rating: known, missingSeriesId: null };
  return { rating: null, missingSeriesId: seriesId };
}

/**
 * Les séries dont la note manque dans une liste — dédoublonnées, dans l'ordre
 * de première apparition.
 *
 * L'ordre est stable pour que la clé de cache le soit : deux rendus de la même
 * rangée doivent produire la même liste, sinon chaque rendu paie sa requête.
 */
export function missingSeriesRatingIds(
  items: readonly MediaItem[],
  scope: CardRatingScope = "series",
  seriesRatings?: ReadonlyMap<string, number> | null,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const { missingSeriesId } = cardRatingFor(item, scope, seriesRatings);
    if (missingSeriesId && !seen.has(missingSeriesId)) {
      seen.add(missingSeriesId);
      out.push(missingSeriesId);
    }
  }
  return out;
}
