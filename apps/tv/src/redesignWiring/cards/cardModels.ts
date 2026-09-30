import { useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FAVORITE_SERIES_IDS_KEY,
  WATCHLIST_SERIES_IDS_KEY,
  seriesStateId,
  useFavoriteSeriesIds,
  useJellyfinClient,
  useMyRatings,
  useSeriesRatings,
  useWatchlistSeriesIds,
  userScoreFromRatings,
  type UserRatingEntry,
} from "@tentacle-tv/api-client";
import { cardRatingFor, missingSeriesRatingIds, resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import type { CardModel } from "../../redesign/cards/cardTypes";
import { landscapeOf, paletteOfItem, posterUriOf, progressOf } from "./cardArtwork";
import { sameCard } from "./sameCard";

/**
 * MediaItem → `CardModel` : ce que les cartes de la refonte reçoivent, déjà
 * résolu — marqueurs par le modèle partagé (`resolveCardMarkers`), images en
 * adresses prêtes, progression, lumière de l'œuvre.
 *
 * Les marqueurs se résolvent au niveau de la LISTE, pas de la carte : la vue
 * rend ses cartes elle-même, l'intégration ne peut pas y glisser un hook par
 * carte. Un seul abonnement donc, aux mêmes caches que `useCardMarkers` (Sets
 * Ma liste et favoris des séries, notes du compte) — patchés par les mêmes
 * mutations. Et des modèles STABLES : une carte dont rien n'a changé garde le
 * même objet, la carte mémoïsée ne se redessine pas.
 */

export interface CardModelOptions {
  /** La carte qui les rendra : vignette 16:9, affiche 2:3, ou carte qui se redresse. */
  variant: "landscape" | "poster" | "morph";
  /** La légende sous la carte, titre par titre (fonction stable de préférence). */
  subtitle?: (item: MediaItem) => string | undefined;
  /** Ce que la carte montre, pour la note : l'item (vignette d'épisode) ou sa
   *  série. Défaut : l'item pour une vignette, la série sinon. */
  scope?: "item" | "series";
  /** L'étiquette du coin haut-gauche (« +3 », « Découverte »). */
  badge?: (item: MediaItem) => string | undefined;
}

export type CardModelFactory = (
  item: MediaItem,
  options: CardModelOptions,
  /** Les notes des séries que les tuiles de lot n'ont pas (`useSeriesRatings`). */
  seriesRatings?: ReadonlyMap<string, number> | null,
) => CardModel;

interface MarkerContext {
  watchlist: ReadonlySet<string> | null;
  favorites: ReadonlySet<string> | null;
  ratings: readonly UserRatingEntry[] | null;
}

function useMarkerContext(): MarkerContext {
  // Ces deux-là lancent et gardent les requêtes des Sets ; les deux lectures
  // qui suivent ne font qu'observer le même cache, pour en tenir le tableau
  // lui-même — dont l'identité ne change qu'avec les données.
  useWatchlistSeriesIds();
  useFavoriteSeriesIds();
  const { data: watchlistIds } = useQuery<string[]>({ queryKey: WATCHLIST_SERIES_IDS_KEY, enabled: false });
  const { data: favoriteIds } = useQuery<string[]>({ queryKey: FAVORITE_SERIES_IDS_KEY, enabled: false });
  const { data: ratings } = useMyRatings();
  return useMemo(
    () => ({
      watchlist: watchlistIds ? new Set(watchlistIds) : null,
      favorites: favoriteIds ? new Set(favoriteIds) : null,
      ratings: ratings ?? null,
    }),
    [watchlistIds, favoriteIds, ratings],
  );
}

/** Le titre d'une carte : la série pour un épisode (son visage), sinon l'item. */
export function cardTitleOf(item: MediaItem): string {
  return item.Type === "Episode" ? item.SeriesName ?? item.Name ?? "" : item.Name ?? "";
}

/** La fabrique de cartes : à composer soi-même (sagas, recommandations…). */
export function useCardModelFactory(): CardModelFactory {
  const client = useJellyfinClient();
  const context = useMarkerContext();
  return useCallback<CardModelFactory>(
    (item, options, seriesRatings) => {
      const scope = options.scope ?? (options.variant === "landscape" ? "item" : "series");
      const seriesId = seriesStateId(item);
      const landscape = landscapeOf(client, item);
      return {
        id: item.Id,
        title: cardTitleOf(item),
        subtitle: options.subtitle?.(item),
        landscapeUri: landscape.uri,
        logoUri: landscape.logoUri,
        posterUri: posterUriOf(client, item),
        markers: resolveCardMarkers({
          item,
          communityRating: cardRatingFor(item, scope, seriesRatings).rating,
          userScore: context.ratings ? userScoreFromRatings(context.ratings, item, scope) : null,
          // Pas de série (film) ou Set pas encore là : le `UserData` répond.
          inWatchlist: seriesId && context.watchlist ? context.watchlist.has(seriesId) : undefined,
          isFavorite: seriesId && context.favorites ? context.favorites.has(seriesId) : undefined,
        }),
        progress: progressOf(item),
        badge: options.badge?.(item),
        palette: paletteOfItem(item),
      };
    },
    [client, context],
  );
}

/** Les cartes d'une liste, en reprenant l'objet précédent de chaque titre
 *  qui n'a pas changé. Un titre en double ne garde que sa première carte. */
function stableCards(
  previous: ReadonlyMap<string, CardModel>,
  items: readonly MediaItem[] | null | undefined,
  build: (item: MediaItem) => CardModel,
): Map<string, CardModel> {
  const next = new Map<string, CardModel>();
  for (const item of items ?? []) {
    if (!item?.Id || next.has(item.Id)) continue;
    const fresh = build(item);
    const old = previous.get(item.Id);
    next.set(item.Id, old && sameCard(old, fresh) ? old : fresh);
  }
  return next;
}

/**
 * Les cartes d'une liste, stables d'un rendu à l'autre. Un titre présent deux
 * fois (deux lots de la même série dans les derniers ajouts) ne garde que sa
 * première carte : la rangée les clé par identifiant.
 */
export function useCardModels(items: readonly MediaItem[] | null | undefined, options: CardModelOptions): CardModel[] {
  const factory = useCardModelFactory();
  const missing = useMemo(() => missingSeriesRatingIds(items ?? []), [items]);
  const seriesRatings = useSeriesRatings(missing);
  const previous = useRef(new Map<string, CardModel>());
  const { variant, subtitle, scope, badge } = options;
  return useMemo(() => {
    const next = stableCards(previous.current, items, (item) => factory(item, { variant, subtitle, scope, badge }, seriesRatings));
    previous.current = next;
    return [...next.values()];
  }, [items, factory, seriesRatings, variant, subtitle, scope, badge]);
}

/** Construit les cartes d'une liste nommée ; `decorate` complète un modèle
 *  (raison d'une recommandation, étiquette « Découverte »…). */
export type CardListBuilder = (
  listKey: string,
  items: readonly MediaItem[] | null | undefined,
  options: CardModelOptions,
  decorate?: (item: MediaItem, card: CardModel) => CardModel,
) => CardModel[];

/**
 * Plusieurs listes de cartes stables, une par clé — pour un écran qui rend
 * toutes ses rangées d'un coup (l'accueil, « Pour vous ») et ne peut donc pas
 * appeler `useCardModels` rangée par rangée. À appeler pendant le rendu, dans
 * un `useMemo` qui dépend du constructeur rendu ici.
 */
export function useCardLists(seriesRatings?: ReadonlyMap<string, number> | null): CardListBuilder {
  const factory = useCardModelFactory();
  const lists = useRef(new Map<string, Map<string, CardModel>>());
  return useCallback<CardListBuilder>(
    (listKey, items, options, decorate) => {
      const build = (item: MediaItem) => {
        const card = factory(item, options, seriesRatings);
        return decorate ? decorate(item, card) : card;
      };
      const next = stableCards(lists.current.get(listKey) ?? new Map(), items, build);
      lists.current.set(listKey, next);
      return [...next.values()];
    },
    [factory, seriesRatings],
  );
}

export { paletteOfItem } from "./cardArtwork";
