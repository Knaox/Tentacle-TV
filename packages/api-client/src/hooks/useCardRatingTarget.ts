import type { MediaItem } from "@tentacle-tv/shared";
import type { RatingIdentity } from "./useRatings";
import { useMediaItem } from "./useLibrary";
import { episodeRatingIdentityFor, ratingIdentityForItem, tmdbIdForItem } from "../utils/ratingIdentity";

/** Ce que les étoiles d'une carte notent. */
export interface CardRatingTarget {
  /** L'identité de notation — `null` : rien de notable (collection, série inconnue…). */
  identity: RatingIdentity | null;
  /** L'item Jellyfin rattaché à la note, pour que la carte la retrouve sans tmdb. */
  jellyfinItemId: string | null;
  /** La série se charge encore : l'identité peut encore apparaître. */
  pending: boolean;
}

/**
 * Ce que la carte MONTRE (cf. `cardRatingFor`) : `series` pour une affiche —
 * un épisode y est le visage de sa série —, `item` pour une vignette 16:9, qui
 * porte le nom de l'épisode et en note donc l'épisode.
 */
export type CardRatingScope = "item" | "series";

const NOTHING: CardRatingTarget = { identity: null, jellyfinItemId: null, pending: false };

/** Vrai quand la note de cette carte passe par sa série (épisode, saison). */
export function cardRatingNeedsSeries(item: MediaItem): boolean {
  if (ratingIdentityForItem(item)) return false;
  return !!item.SeriesId && (item.Type === "Episode" || item.Type === "Season");
}

/**
 * La règle, en pur : la même que les marqueurs (`useCardMarkers`), pour que la
 * note posée depuis le survol apparaisse sur la carte même — l'affiche d'un
 * épisode retrouve la note de sa SÉRIE, la vignette celle de l'épisode.
 */
export function resolveCardRatingTarget(
  item: MediaItem,
  series: MediaItem | null | undefined,
  scope: CardRatingScope,
): Omit<CardRatingTarget, "pending"> {
  const own = ratingIdentityForItem(item);
  if (own) return { identity: own, jellyfinItemId: item.Id };
  if (!cardRatingNeedsSeries(item) || !series) return { identity: null, jellyfinItemId: null };
  if (scope === "item" && item.Type === "Episode") {
    const identity = episodeRatingIdentityFor(item, tmdbIdForItem(series));
    return { identity, jellyfinItemId: identity ? item.Id : null };
  }
  const identity = ratingIdentityForItem(series);
  return { identity, jellyfinItemId: identity ? series.Id : null };
}

/**
 * Ce que noter une carte veut dire.
 *
 * Un film et une série portent leur tmdb. Un ÉPISODE non : celui de ses
 * `ProviderIds` est le sien, inutilisable par le moteur de notes, qui note un
 * épisode par le tmdb de SA SÉRIE, sa saison et son numéro. La série se
 * charge donc à la demande — `enabled` le temps d'un survol, d'une feuille ou
 * d'un focus —, et la fiche la tient souvent déjà en cache. Sans cela, les
 * « Derniers ajouts » et « Reprendre » n'offraient aucune étoile.
 */
export function useCardRatingTarget(
  item: MediaItem | null,
  options: { scope: CardRatingScope; enabled: boolean },
): CardRatingTarget {
  const needsSeries = !!item && cardRatingNeedsSeries(item);
  const { data: series, isFetching } = useMediaItem(needsSeries ? (item?.SeriesId ?? undefined) : undefined, {
    enabled: options.enabled && needsSeries,
  });

  if (!item) return NOTHING;
  const target = resolveCardRatingTarget(item, series, options.scope);
  const pending = needsSeries && !series && options.enabled && isFetching;
  return { ...target, pending };
}
