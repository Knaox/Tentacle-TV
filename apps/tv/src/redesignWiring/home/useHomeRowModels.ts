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
import { holdPanelOf, type HoldPanel, type HomeRowKind as HoldRowKind } from "@tentacle-tv/tv-core";
import type { HomeRowModel } from "../../redesign/screens/home/HomeView";
import { useTVHomeRows } from "../../components/home/useTVHomeRows";
import { useCardLists } from "../cards/cardModels";
import { episodeRowSubtitle, itemSubtitle, latestCardLines, latestSubtitle, resumeSubtitle, yearOf } from "./homeSubtitles";
import { useHomeRecoSource } from "./useHomeRecoSource";

/**
 * Les rangées de l'accueil refondu, dans l'ordre de la mise en page du COMPTE
 * (`useTVHomeRows` : celle que le web édite, réconciliée avec les
 * bibliothèques). Les rangées d'épisodes en vignettes 16:9 — Reprendre,
 * Prochains épisodes, Déjà vu (OK = lecture, appui long = le panneau de la
 * vignette) ; toutes les autres en AFFICHES (OK = la fiche) : Ma liste,
 * Favoris, Derniers ajouts par bibliothèque, rangées recommandées — « comme
 * sur le bureau » (2026-10-01 ; Prochains épisodes puis Déjà vu passés en
 * 16:9 le 2026-10-02, au retour de l'essai : « au format vertical au lieu
 * d'horizontal comme desktop »).
 *
 * Chaque carte garde l'item qu'elle montre (`targetOf`) : l'appui, l'appui
 * long et la lumière du fond en partent. Le panneau de l'appui maintenu est la
 * règle de tv-core (`cards/cardHold`, `holdPanelOf`), selon la rangée.
 */

export type HomeRowKind = "play" | "detail" | "reco";

export interface HomeCardTarget {
  item: MediaItem;
  /** La recommandation derrière la carte (rangées `reco:`). */
  reco?: RecoRowItem;
  /** Ce que fait OK : lire (vignettes 16:9), ouvrir la fiche, ou la fiche d'une reco. */
  kind: HomeRowKind;
  /** Le panneau qu'ouvre l'appui maintenu ; `null` : pas d'appui maintenu. */
  panel: HoldPanel | null;
}

/** Le panneau de l'appui maintenu sur une carte de cette rangée. */
const panelOf = (row: HoldRowKind) => holdPanelOf({ surface: "homeRow", row });

export interface HomeRowsModel {
  rows: HomeRowModel[];
  targetOf: (rowKey: string, cardId: string) => HomeCardTarget | undefined;
  /** Les données qui décident de l'état de l'écran. */
  resume: MediaItem[] | undefined;
}

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
      if (key === "resume") {
        const items = resume ?? [];
        const subtitle = (item: MediaItem) => resumeSubtitle(item, t);
        rows.push({ key, title: t("common:resumeWatching"), variant: "landscape", cards: lists(key, items, { variant: "landscape", subtitle }) });
        register(key, items, { kind: "play", panel: panelOf("resume") });
      } else if (key === "nextUp" || key === "watched") {
        // La vignette de l'ÉPISODE (repli : son fond, puis celui de la série —
        // `resolveBannerImage`, la règle du bureau) ; sa note, pas celle de la série.
        const items = (key === "nextUp" ? nextUp : watched) ?? [];
        const title = key === "nextUp" ? t("common:nextEpisodes") : t("common:alreadyWatched");
        rows.push({ key, title, variant: "landscape", cards: lists(key, items, { variant: "landscape", subtitle: episodeRowSubtitle }) });
        register(key, items, { kind: "play", panel: panelOf(key) });
      } else if (key === "watchlist" || key === "favorites") {
        const items = (key === "watchlist" ? watchlist : favorites) ?? [];
        const title = key === "watchlist" ? t("common:myList") : t("common:myFavorites");
        rows.push({ key, title, variant: "poster", cards: lists(key, items, { variant: "poster", subtitle: (item) => itemSubtitle(item) }) });
        register(key, items, { kind: "detail", panel: panelOf(key) });
      } else if (key.startsWith("library:")) {
        const index = libraryRows.findIndex((lib) => lib.key === key);
        const items = index >= 0 ? latestData[index] ?? [] : [];
        const name = index >= 0 ? libraryRows[index].name : "";
        rows.push({
          key,
          title: t("common:latestAdditions", { name }),
          variant: "poster",
          cards: lists(key, items, { variant: "poster", subtitle: (item) => latestSubtitle(item, t) }, latestCardLines),
        });
        register(key, items, { kind: "detail", panel: panelOf("library") });
      } else if (key.startsWith("reco:")) {
        const source = recoRows.find((row) => row.layoutKey === key);
        if (!source) continue;
        const title = recoRowTitle(source.row);
        const byItem = new Map(source.entries.map((entry) => [entry.item.Id, entry.reco]));
        const items = source.entries.map((entry) => entry.item);
        const cards = lists(key, items, { variant: "poster", subtitle: yearOf }, (item, card) =>
          byItem.get(item.Id)?.exploration ? { ...card, badge: t("reco:explorationBadge") } : card,
        );
        rows.push({ key, title: t(`reco:${title.key}`, title.params), variant: "poster", cards });
        targets.set(key, new Map(source.entries.map((entry) => [entry.item.Id, { item: entry.item, reco: entry.reco, kind: "reco", panel: panelOf("reco") }])));
      }
    }
    const targetOf = (rowKey: string, cardId: string) => targets.get(rowKey)?.get(cardId);
    return { rows: rows.filter((row) => row.cards.length > 0), targetOf, resume };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `latestStamp` résume `latestData`
  }, [layout, resume, nextUp, watched, watchlist, favorites, libraryRows, latestStamp, recoRows, lists, t]);
}
