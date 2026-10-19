import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFavoritesAll, useWatchlistAll } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { DEFAULT_LIST_GROUP, GRID_FIRST_KEY, collectionEntryKey, groupItems } from "@tentacle-tv/tv-core";
import { railNavigate } from "../../navigation/railNavigate";
import { RENDER } from "../../redesign/render/renderProfile";
import { CollectionView, type CollectionEmptyModel } from "../../redesign/screens/collection/CollectionView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { NEUTRAL_PALETTE } from "../../redesign/color/artworkPalette";
import { ListGroupRows, groupableOf, listRowKey } from "../groups/ListGroupRows";
import { useRowCardActions } from "../groups/useRowCardActions";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useHeldWhile } from "../screen/useHeldWhile";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { useCollectionFilterBar, useCollectionSort, type CollectionKind as Kind } from "./useCollectionFilters";

interface CollectionQuery {
  data: MediaItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}

const goHome = () => railNavigate("Home");
const NO_CARDS: never[] = [];

/** Android TV : la grille sous une liste ouverte ne suit pas chaque choix
 *  (profil `holdUnderPanels`, comme la bibliothèque). */
const HOLD_UNDER_SHEET = RENDER.holdUnderPanels;

/**
 * Ma liste et Favoris, refondus (Apple TV, Android TV) : toute la collection
 * EN RANGÉES depuis la carte qui s'ouvre (banc validé par Damien le 19/10) —
 * « Ranger par » type, genre ou lettres, chaque titre dans une seule rangée
 * (`ListGroupRows`, tv-core `groups/listGroups.ts`), la même taille de carte
 * que l'Accueil —, sur les mêmes requêtes que l'écran d'Android
 * TV (`useWatchlistAll`, `Filters=Likes` ; `useFavoritesAll`,
 * `Filters=IsFavorite`). Ce que l'ancien écran n'avait pas : l'erreur, qui
 * s'y lisait comme une collection vide. Vide, la page offre une sortie
 * (« Parcourir les bibliothèques ») — un écran sans focalisable serait muet.
 *
 * Sous le titre, la barre de la bibliothèque réduite au type et au tri
 * (CO-3, CO-4 : `useCollectionFilters`) ; la liste rangée en mémoire par la
 * règle commune `filterCollection`.
 */
function CollectionRedesign({ kind, query }: { kind: Kind; query: CollectionQuery }) {
  const { t } = useTranslation();
  const watchlist = kind === "watchlist";
  const { data, isLoading, isError, refetch } = query;
  const items = useMemo(() => data ?? [], [data]);
  const sort = useCollectionSort(kind, data);
  const actions = useRowCardActions();
  const mode = sort.state.groupBy ?? DEFAULT_LIST_GROUP;
  const groups = useMemo(() => groupItems(sort.visible.map(groupableOf), mode), [sort.visible, mode]);
  const { register } = actions;
  useEffect(() => register(sort.visible), [register, sort.visible]);

  const loading = isLoading && !data;
  const retry = useCallback(() => void refetch(), [refetch]);
  const status: StatusPanelProps | null = isError && !data
    ? {
        kind: "error",
        title: t("common:contentErrorTitle"),
        message: t("common:contentErrorMessage"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: retry },
        secondary: { label: t("common:backHome"), icon: "home", onPress: goHome },
      }
    : null;
  const empty: CollectionEmptyModel | null = !loading && !status && items.length === 0
    ? {
        icon: watchlist ? "bookmark" : "heart",
        title: t(watchlist ? "common:emptyWatchlist" : "common:emptyFavorites"),
        message: t(watchlist ? "common:emptyWatchlistHint" : "common:emptyFavoritesHint"),
        actionLabel: t("common:browseLibraries"),
      }
    : null;
  const noResults = !loading && !status && !empty && sort.visible.length === 0
    ? { title: t("library:emptyFilteredTitle"), message: t("library:emptyFilteredHint"), actionLabel: t("library:clearAll") }
    : null;

  const first = groups[0] ? `${listRowKey(groups[0])}:0` : GRID_FIRST_KEY;
  const screen = useRedesignScreen({
    railKey: watchlist ? "Watchlist" : "Favorites",
    entryKey: collectionEntryKey({ failed: status !== null, empty: empty !== null, cards: sort.visible.length, noResults: noResults !== null }, first),
    rewindRows: true,
  });
  const filters = useCollectionFilterBar(t, sort, screen.focus, first);
  const { sheets, bar } = filters;
  // Ce que la liste ouverte COUVRE reste tel quel jusqu'à la fin de son fondu
  // (cf. `LibraryRedesign`) : une coche ne redessine que la liste.
  const under = useHeldWhile(
    { count: t("library:titles", { count: sort.visible.length }), groups, visible: sort.visible, pills: filters.pills, active: filters.active, noResults },
    HOLD_UNDER_SHEET && sheets.covering,
  );
  const rows = useMemo(
    () => <ListGroupRows groups={under.groups} items={under.visible} actions={actions} />,
    [under.groups, under.visible, actions],
  );

  return (
    <RedesignScreen screen={screen}>
      <CollectionView
        nav={screen.nav}
        kicker={t(watchlist ? "watchlist:kicker" : "favorites:kicker")}
        title={t(watchlist ? "common:myList" : "common:myFavorites")}
        count={under.count}
        cards={NO_CARDS}
        rows={rows}
        palette={NEUTRAL_PALETTE}
        ambient={actions.ambient}
        loading={loading}
        empty={empty}
        status={status}
        onEmptyAction={goHome}
        pills={under.pills}
        activeFilters={under.active}
        filterLabels={filters.labels}
        noResults={under.noResults}
        sheet={sheets.sheet}
        onPressPill={bar.onPressPill}
        onRemoveFilter={bar.onRemoveFilter}
        onClearAll={bar.onClearAll}
        onSheetOption={sheets.onSheetOption}
        onSheetClear={sheets.onSheetClear}
        onSheetApply={sheets.onSheetApply}
        onSheetClose={sheets.closeSheet}
        onSheetExited={sheets.onSheetExited}
      />
      {actions.sheet}
    </RedesignScreen>
  );
}

export function WatchlistRedesign() {
  return <CollectionRedesign kind="watchlist" query={useWatchlistAll()} />;
}

export function FavoritesRedesign() {
  return <CollectionRedesign kind="favorites" query={useFavoritesAll()} />;
}
