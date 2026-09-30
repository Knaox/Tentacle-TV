import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { i18n, type MediaItem } from "@tentacle-tv/shared";
import { NEUTRAL_PALETTE } from "../../../src/redesign/color/artworkPalette";
import { DetailView, type DetailViewProps } from "../../../src/redesign/screens/detail/DetailView";
import type { BenchData } from "../data/benchData";
import { actionsOf, backdropOf, episodesOf, headerOf, watchStateOf } from "../data/detailModels";
import { castOf, crewOf, extrasExample, sagaOf, similarOf } from "../data/detailSectionModels";
import { cardOf, paletteOf, seriesOf, yearOf } from "../data/models";
import type { BenchScene } from "./types";

/**
 * La fiche média, sur les vraies données du compte : un film et sa saga, un
 * film en cours avec les portraits de sa distribution, One Piece (reprise en
 * saison 11, 80 épisodes), Bleach jamais commencée, un épisode, une série
 * dans Ma liste et les favoris. Les états que le compte n'a pas (note perso,
 * extras, rappel des bandes-annonces, collection, logo absent) se montrent sur
 * une COPIE d'un vrai titre — « (exemple) ».
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;

const ID = {
  michael: "ebcad8f8c68e52fd24bd0eb19cfae136",
  pride: "e86346a08c2bb2900795777307b0a32d",
  avatar: "8691fdd93af7c11da75013ecc6a67ac0",
  onePiece: "1e98cd83a1295aeb9336e87a46afe1d6",
  onePieceS1: "7388d3fa9a1bf019d8ec3fba0521b371",
  onePieceS13: "8931b0c1655493246c867eeea56c6a36",
  onePieceS1E3: "b4a8e13e90030bf8c809a8f535da5cd8",
  bleach: "37ef170883b345300ba7bdabcca7c084",
  rick: "c2e997cc19afc07f6310f6f86ba1f648",
  shawshank: "fcfbd7a81518be2f40de85b0d1ccd46f",
  chihiro: "a00587f4aa390f0e9aa9fc37bb11a35c",
} as const;

interface Options {
  seasonId?: string;
  /** Retouche d'EXEMPLE sur une copie de l'élément (logo retiré, note posée…). */
  patch?: (item: MediaItem) => MediaItem;
  tweak?: (props: DetailViewProps, data: BenchData) => DetailViewProps;
}

/** Tout ce que l'intégration tirera des hooks, tiré de l'instantané. */
function detailOf(data: BenchData, id: string, options: Options = {}): DetailViewProps {
  const found = data.item(id);
  if (!found) return { header: null, palette: NEUTRAL_PALETTE, error: { title: `${id} : absent de l'instantané` } };
  const item = options.patch ? options.patch(found) : found;
  const series = item.Type === "Episode" ? seriesOf(data, item) : undefined;
  const seriesId = item.Type === "Series" ? item.Id : item.SeriesId ?? undefined;
  // Sans ses épisodes dans l'instantané, l'état de visionnage est inconnu —
  // pas « terminée » : la pilule garde « Lecture ».
  const watch = item.Type === "Series" && data.snapshot.seasons[item.Id]?.length ? watchStateOf(data, item.Id) : undefined;
  const people = series ?? item;
  const props: DetailViewProps = {
    header: headerOf(data, item),
    actions: actionsOf(data, item, watch),
    backdropUri: backdropOf(data, item),
    palette: paletteOf(data, item),
    episodes: seriesId
      ? episodesOf(data, seriesId, {
          watch,
          seasonId: options.seasonId ?? (item.Type === "Episode" ? item.SeasonId ?? undefined : undefined),
          currentEpisodeId: item.Type === "Episode" ? item.Id : undefined,
        })
      : undefined,
    cast: castOf(data, people),
    crew: crewOf(people),
    saga: item.Type === "Movie" ? sagaOf(data, item) : null,
    similar: similarOf(data, series ?? item),
  };
  return options.tweak ? options.tweak(props, data) : props;
}

/** Les images à précharger : ce que le premier écran et la section ancrée montrent. */
function imagesOf(props: DetailViewProps): string[] {
  const anchor = props.episodes?.anchorIndex ?? 0;
  return [
    props.backdropUri,
    props.header?.logoUri,
    ...(props.episodes?.episodes ?? []).slice(anchor, anchor + 5).map((e) => e.imageUri),
    ...(props.cast ?? []).slice(0, 9).map((p) => p.imageUri),
    ...(props.extras ?? []).map((e) => e.imageUri),
    ...(props.saga?.entries ?? []).map((e) => e.card?.posterUri),
    ...(props.similar ?? []).slice(0, 7).map((c) => c.posterUri),
    ...(props.collection ?? []).slice(0, 7).map((c) => c.posterUri),
  ].filter((uri): uri is string => !!uri);
}

/** La fiche vivante : un onglet de saison choisi au simulateur change la saison. */
function DetailScene({ data, build }: { data: BenchData; build: (data: BenchData, seasonId?: string) => DetailViewProps }) {
  const { i18n: live } = useTranslation();
  const [seasonId, setSeasonId] = useState<string | undefined>(undefined);
  const props = useMemo(() => build(data, seasonId), [build, data, seasonId, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  return <DetailView {...props} onSelectSeason={setSeasonId} />;
}

type Build = (data: BenchData, seasonId?: string) => DetailViewProps;

function scene(id: string, label: string, focusKeys: string[], build: Build): BenchScene {
  return {
    id: `fiche/${id}`,
    group: "Fiche",
    label,
    focusKeys,
    settleMs: 1800,
    images: (data) => imagesOf(build(data)),
    render: (data) => <DetailScene data={data} build={build} />,
  };
}

const HEADER_KEYS = ["detail:primary", "detail:list", "detail:favorite", "detail:watched", "detail:rate"];

export const DETAIL_SCENES: BenchScene[] = [
  scene("film-saga", "Film, saga et similaires (Michael)", [...HEADER_KEYS, "cast:0", "saga:0", "saga:1", "similar:1"], (data) =>
    detailOf(data, ID.michael)),
  scene("film-reprise", "Film en cours, portraits (Orgueil et Préjugés)", ["detail:primary", "detail:list", "cast:0", "cast:2"], (data) =>
    detailOf(data, ID.pride)),
  scene("film-sans-logo", "Film sans logo (exemple)", ["detail:primary"], (data) =>
    detailOf(data, ID.avatar, { tweak: (props) => ({ ...props, header: props.header && { ...props.header, logoUri: undefined } }) })),
  scene("serie", "Série, reprise S11 · E58 (One Piece)", ["detail:primary", "season:11", "season:12", "episode:57", "episode:58", "cast:0"], (data, seasonId) =>
    detailOf(data, ID.onePiece, { seasonId })),
  scene("serie-saison-1", "Série, saison 1 : vus (One Piece)", ["season:1", "episode:0", "episode:2"], (data, seasonId) =>
    detailOf(data, ID.onePiece, { seasonId: seasonId ?? ID.onePieceS1 })),
  scene("serie-saison-80", "Saison de 80 épisodes (One Piece S13)", ["season:13", "episode:0", "episode:1"], (data, seasonId) =>
    detailOf(data, ID.onePiece, { seasonId: seasonId ?? ID.onePieceS13 })),
  scene("serie-chargement-saison", "Saison en chargement (One Piece)", ["season:11"], (data) =>
    detailOf(data, ID.onePiece, { tweak: (props) => ({ ...props, episodes: props.episodes && { ...props.episodes, episodes: null } }) })),
  scene("bleach", "Série jamais commencée (Bleach)", ["detail:primary", "season:0", "episode:0"], (data, seasonId) =>
    detailOf(data, ID.bleach, { seasonId })),
  scene("serie-favori", "Série dans Ma liste et favorite (Rick et Morty)", ["detail:list", "detail:favorite"], (data) =>
    detailOf(data, ID.rick)),
  scene("episode", "Épisode (One Piece S1 · E3)", ["detail:primary", "detail:series", "episode:2"], (data, seasonId) =>
    detailOf(data, ID.onePieceS1E3, { seasonId })),
  scene("bonus", "Extras (exemple)", ["extra:0", "extra:3"], (data) =>
    detailOf(data, ID.shawshank, { tweak: (props, d) => ({ ...props, extras: extrasExample(d, d.item(ID.shawshank)!) }) })),
  scene("note-perso", "Note perso posée (exemple)", ["detail:rate", "detail:primary"], (data) =>
    detailOf(data, ID.chihiro, {
      tweak: (props) => ({
        ...props,
        header: props.header && { ...props.header, userScore: 8 },
        actions: props.actions && { ...props.actions, rating: { score: 8 } },
      }),
    })),
  scene("rappel-bandes-annonces", "Rappel « bandes-annonces » (exemple)", ["detail:primary"], (data) =>
    detailOf(data, ID.pride, { tweak: (props) => ({ ...props, showTrailerHint: true }) })),
  scene("bande-annonce", "Avec bande-annonce (exemple)", ["detail:trailer"], (data) =>
    detailOf(data, ID.michael, { tweak: (props) => ({ ...props, actions: props.actions && { ...props.actions, trailer: true } }) })),
  scene("collection", "Collection (exemple)", ["collection:0"], (data) =>
    detailOf(data, ID.michael, {
      // La collection que Jellyfin crée d'une saga TMDB : son nom réel, son
      // contenu fait du film et de titres voisins — sans logo, comme la plupart.
      patch: (item) => ({ ...item, Type: "BoxSet", RunTimeTicks: undefined, OfficialRating: undefined }),
      tweak: (props, d) => {
        const michael = d.item(ID.michael)!;
        const collection = [cardOf(d, michael, yearOf(michael)), ...similarOf(d, michael).slice(0, 7)];
        const saga = sagaOf(d, michael);
        return {
          ...props,
          header: props.header && {
            ...props.header,
            title: saga?.title ?? props.header.title,
            logoUri: undefined,
            meta: [t("media:collectionTitles", { count: collection.length }), ...props.header.meta.filter((m) => typeof m === "object" && "rating" in m)],
            badges: [],
          },
          saga: null,
          similar: [],
          cast: [],
          crew: [],
          collection,
        };
      },
    })),
  scene("chargement", "Chargement", [], (data) => ({
    header: null,
    palette: (data.item(ID.michael) && paletteOf(data, data.item(ID.michael)!)) || NEUTRAL_PALETTE,
  })),
  scene("erreur", "Erreur", ["status:primary"], () => ({
    header: null,
    palette: NEUTRAL_PALETTE,
    error: { title: t("common:contentErrorTitle"), message: t("common:contentErrorMessage") },
    onBack: () => undefined,
  })),
];
