import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  useCardRatingTarget,
  useCardToggles,
  useItemTrailer,
  useJellyfinClient,
  useMediaItem,
  useSeriesWatchState,
  useTrailerHint,
  type CardRatingTarget,
  type CardToggles,
  type ItemTrailer,
} from "@tentacle-tv/api-client";
import type { MediaItem, NextEpisodeResult } from "@tentacle-tv/shared";
import { useTVUserScore } from "../../components/cards/actions/useTVUserScore";
import type { DetailViewProps } from "../../redesign/screens/detail/DetailView";
import type { DetailActionsModel } from "../../redesign/screens/detail/detailTypes";
import { paletteOfItem } from "../cards/cardModels";
import { detailBackdropUri, detailLogoUri } from "./detailImages";
import { headerModelOf, playModelOf } from "./detailModels";
import { castOf, crewOf } from "./detailPeople";
import { useDetailCards, type DetailCards } from "./useDetailCards";
import { useDetailEpisodes, type DetailEpisodes } from "./useDetailEpisodes";
import { useDetailExtras, type DetailExtras } from "./useDetailExtras";

/**
 * Tout ce que la fiche refondue montre, tiré des hooks de l'app — les mêmes
 * que la fiche actuelle et que les autres plateformes :
 * - l'item (`useMediaItem`, la clé que les bascules patchent), la série d'un
 *   épisode ;
 * - la lecture (`useSeriesWatchState`), la bande-annonce (`useItemTrailer`),
 *   le rappel (`useTrailerHint`) ;
 * - Ma liste, favori, vu (`useCardToggles`, la logique unique des cartes) ;
 * - la note (`useCardRatingTarget`, portée « item » : un épisode note
 *   l'épisode) — nouvelle sur la fiche, elle n'existait que dans la feuille ;
 * - saisons et épisodes, extras, collection, saga, titres similaires.
 * Les gestes vivent à côté (`useDetailActions`) : ce hook ne navigue pas.
 */

export type DetailModelProps = Pick<
  DetailViewProps,
  | "header"
  | "actions"
  | "backdropUri"
  | "palette"
  | "showTrailerHint"
  | "error"
  | "episodes"
  | "cast"
  | "crew"
  | "extras"
  | "collection"
  | "saga"
  | "similar"
>;

export interface DetailModel {
  item: MediaItem | undefined;
  /** La série d'un épisode (sa distribution, ses extras, le lien). */
  series: MediaItem | undefined;
  props: DetailModelProps;
  watch: NextEpisodeResult | undefined;
  /** L'état de visionnage d'une série est connu (ou n'a pas lieu d'être). */
  playSettled: boolean;
  trailer: ItemTrailer;
  toggles: CardToggles;
  rating: CardRatingTarget;
  episodes: DetailEpisodes;
  extras: DetailExtras;
  cards: DetailCards;
  refetch: () => void;
}

export function useDetailModel(itemId: string): DetailModel {
  const { t, i18n } = useTranslation();
  const client = useJellyfinClient();
  const lang = i18n.language;
  const query = useMediaItem(itemId);
  const item = query.data;
  const isEpisode = item?.Type === "Episode";
  const isSeries = item?.Type === "Series";
  const { data: series } = useMediaItem(isEpisode ? item?.SeriesId : undefined);

  const watchQuery = useSeriesWatchState(isSeries ? item?.Id : undefined);
  const watch = watchQuery.data;
  const trailer = useItemTrailer(item, lang);
  const hint = useTrailerHint({ itemType: item?.Type, trailerVisible: trailer.visible, trailerSettled: trailer.settled });
  // Un visage vide tant que l'item se charge : les hooks s'appellent toujours.
  const toggles = useCardToggles(item ?? PLACEHOLDER);
  const rating = useCardRatingTarget(item ?? null, { scope: "item", enabled: !!item });
  const score = useTVUserScore(rating.identity) ?? null;
  const episodes = useDetailEpisodes(item, watch);
  const extras = useDetailExtras(item, series, lang);
  const cards = useDetailCards(item, series);
  // Une collection compte ses titres par son contenu, dès qu'il est là.
  const collectionCount = cards.collection.length || undefined;

  const header = useMemo(
    () =>
      item
        ? headerModelOf({ item, logoUri: detailLogoUri(client, item), userScore: score, collectionCount, t, locale: lang })
        : null,
    [item, client, score, collectionCount, t, lang],
  );
  const people = isEpisode ? series ?? item : item;
  const cast = useMemo(() => (people ? castOf(client, people) : []), [client, people]);
  const crew = useMemo(() => (people ? crewOf(people, t) : []), [people, t]);

  const { watchlist, favorite, watched } = toggles;
  const rateable = rating.identity !== null || rating.pending;
  const actions = useMemo<DetailActionsModel | undefined>(
    () =>
      item
        ? {
            play: playModelOf(item, watch, t),
            trailer: trailer.visible,
            watchlist,
            favorite,
            watched,
            rating: rateable ? { score } : undefined,
          }
        : undefined,
    [item, watch, t, trailer.visible, watchlist, favorite, watched, rateable, score],
  );

  const error = query.isError && !item ? { title: t("common:contentErrorTitle"), message: t("common:contentErrorMessage") } : null;

  return {
    item,
    series,
    props: {
      header,
      actions,
      backdropUri: item ? detailBackdropUri(client, item) : undefined,
      // La lumière de l'œuvre ; celle de sa série pour un épisode sans image.
      palette: paletteOfItem(item, series),
      showTrailerHint: hint.show,
      error,
      episodes: episodes.model,
      cast,
      crew,
      extras: extras.extras,
      collection: cards.collection,
      saga: cards.saga,
      similar: cards.similar,
    },
    watch,
    playSettled: !isSeries || watch !== undefined || watchQuery.isError,
    trailer,
    toggles,
    rating,
    episodes,
    extras,
    cards,
    refetch: () => void query.refetch(),
  };
}

/** L'item vide d'une fiche qui se charge : `useCardToggles` n'y lit rien. */
const PLACEHOLDER = { Id: "", Name: "", Type: "Movie" } as MediaItem;
