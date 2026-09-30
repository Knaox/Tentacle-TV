import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@tanstack/react-query";
import {
  latestItemsQueryOptions,
  recoRowTitle,
  useFavorites,
  useJellyfinClient,
  useLibraries,
  useNextUp,
  useResumeItems,
  useSeriesRatings,
  useUserId,
  useWatchedItems,
  useWatchlist,
  type RecoRowItem,
} from "@tentacle-tv/api-client";
import { missingSeriesRatingIds, type MediaItem } from "@tentacle-tv/shared";
import type { HomeRowModel } from "../../redesign/screens/home/HomeView";
import { useTVHomeRows } from "../../components/home/useTVHomeRows";
import { useCardLists } from "../cards/cardModels";
import { itemSubtitle, latestSubtitle, resumeSubtitle, yearOf } from "./homeSubtitles";
import { useHomeRecoSource } from "./useHomeRecoSource";

/**
 * Les rangées de l'accueil refondu, dans l'ordre de la mise en page du COMPTE
 * (`useTVHomeRows` : celle que le web édite, réconciliée avec les
 * bibliothèques) : Reprendre · Prochains épisodes · Déjà vu en vignettes 16:9
 * (OK = lecture) ; Ma liste · Favoris en affiches ; Derniers ajouts par
 * bibliothèque et rangées recommandées en cartes qui se redressent.
 *
 * Chaque carte garde l'item qu'elle montre (`targetOf`) : l'appui, l'appui
 * long et la lumière du fond en partent.
 */

export type HomeRowKind = "play" | "detail" | "reco";

export interface HomeCardTarget {
  item: MediaItem;
  /** La recommandation derrière la carte (rangées `reco:`). */
  reco?: RecoRowItem;
  /** Ce que fait OK : lire (vignettes 16:9), ouvrir la fiche, ou la fiche d'une reco. */
  kind: HomeRowKind;
  /** La variante de la feuille d'actions (appui long). */
  sheet: "landscape" | "poster" | "reco";
}

export interface HomeRowsModel {
  rows: HomeRowModel[];
  targetOf: (rowKey: string, cardId: string) => HomeCardTarget | undefined;
  /** Les données qui décident de l'état de l'écran. */
  resume: MediaItem[] | undefined;
}

const LANDSCAPE_ROWS = new Set(["resume", "nextUp", "watched"]);

export function useHomeRowModels(): HomeRowsModel {
  const { t } = useTranslation();
  const client = useJellyfinClient();
  const userId = useUserId();
  const { rows: layout } = useTVHomeRows();
  const has = (key: string) => layout.some((row) => row.key === key);

  const resume = useResumeItems().data;
  const nextUp = useNextUp().data;
  const watched = useWatchedItems().data;
  const watchlist = useWatchlist().data;
  const favorites = useFavorites({ enabled: has("favorites") }).data;
  const { data: libraries } = useLibraries();

  // Les derniers ajouts de CHAQUE bibliothèque de la mise en page, d'un coup —
  // même clé et même regroupement que `useLatestItems` (un seul cache).
  const libraryRows = useMemo(
    () =>
      layout.flatMap((row) => {
        if (!row.key.startsWith("library:")) return [];
        const library = libraries?.find((lib) => lib.Id === row.key.slice("library:".length));
        return library ? [{ key: row.key, id: library.Id, name: library.Name, collectionType: library.CollectionType }] : [];
      }),
    [layout, libraries],
  );
  const latest = useQueries({
    queries: libraryRows.map((lib) => latestItemsQueryOptions(client, userId, lib.id, { collectionType: lib.collectionType })),
  });
  const latestData = latest.map((query) => query.data as MediaItem[] | undefined);
  const latestStamp = latest.map((query) => query.dataUpdatedAt).join("|");

  const recoRows = useHomeRecoSource(layout);

  // Les notes que les tuiles de lot (« +3 épisodes ») n'ont pas, en une requête.
  const missing = useMemo(
    () => missingSeriesRatingIds(latestData.flatMap((items) => items ?? [])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `latestStamp` résume les données des lots
    [latestStamp],
  );
  const seriesRatings = useSeriesRatings(missing);
  const lists = useCardLists(seriesRatings);

  return useMemo(() => {
    const targets = new Map<string, Map<string, HomeCardTarget>>();
    const register = (rowKey: string, items: readonly MediaItem[], target: Omit<HomeCardTarget, "item">) =>
      targets.set(rowKey, new Map(items.map((item) => [item.Id, { ...target, item }])));
    const rows: HomeRowModel[] = [];

    for (const { key } of layout) {
      if (LANDSCAPE_ROWS.has(key)) {
        const items = (key === "resume" ? resume : key === "nextUp" ? nextUp : watched) ?? [];
        const title = key === "resume" ? t("common:resumeWatching") : key === "nextUp" ? t("common:nextEpisodes") : t("common:alreadyWatched");
        const subtitle = key === "resume" ? (item: MediaItem) => resumeSubtitle(item, t) : (item: MediaItem) => itemSubtitle(item, key === "nextUp");
        rows.push({ key, title, variant: "landscape", cards: lists(key, items, { variant: "landscape", subtitle }) });
        register(key, items, { kind: "play", sheet: "landscape" });
      } else if (key === "watchlist" || key === "favorites") {
        const items = (key === "watchlist" ? watchlist : favorites) ?? [];
        const title = key === "watchlist" ? t("common:myList") : t("common:myFavorites");
        rows.push({ key, title, variant: "poster", cards: lists(key, items, { variant: "poster", subtitle: (item) => itemSubtitle(item) }) });
        register(key, items, { kind: "detail", sheet: "poster" });
      } else if (key.startsWith("library:")) {
        const index = libraryRows.findIndex((lib) => lib.key === key);
        const items = index >= 0 ? latestData[index] ?? [] : [];
        const name = index >= 0 ? libraryRows[index].name : "";
        rows.push({
          key,
          title: t("common:latestAdditions", { name }),
          variant: "morph",
          cards: lists(key, items, { variant: "morph", subtitle: (item) => latestSubtitle(item, t) }),
        });
        register(key, items, { kind: "detail", sheet: "poster" });
      } else if (key.startsWith("reco:")) {
        const source = recoRows.find((row) => row.layoutKey === key);
        if (!source) continue;
        const title = recoRowTitle(source.row);
        const byItem = new Map(source.entries.map((entry) => [entry.item.Id, entry.reco]));
        const items = source.entries.map((entry) => entry.item);
        const cards = lists(key, items, { variant: "morph", subtitle: yearOf }, (item, card) =>
          byItem.get(item.Id)?.exploration ? { ...card, badge: t("reco:explorationBadge") } : card,
        );
        rows.push({ key, title: t(`reco:${title.key}`, title.params), variant: "morph", cards });
        targets.set(key, new Map(source.entries.map((entry) => [entry.item.Id, { item: entry.item, reco: entry.reco, kind: "reco", sheet: "reco" }])));
      }
    }
    const targetOf = (rowKey: string, cardId: string) => targets.get(rowKey)?.get(cardId);
    return { rows: rows.filter((row) => row.cards.length > 0), targetOf, resume };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `latestStamp` résume `latestData`
  }, [layout, resume, nextUp, watched, watchlist, favorites, libraryRows, latestStamp, recoRows, lists, t]);
}
