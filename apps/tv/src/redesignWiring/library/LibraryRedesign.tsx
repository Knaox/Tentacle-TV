import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGenres, useLibraries } from "@tentacle-tv/api-client";
import { hasPlatformFilter } from "../../hooks/libraryCatalogParams";
import { useLibraryFilters } from "../../hooks/useLibraryFilters";
import { railNavigate } from "../../navigation/railNavigate";
import type { RootStackParamList } from "../../navigation/types";
import { LibraryView } from "../../redesign/screens/library/LibraryView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { AutoFocusGuide } from "../focus/focusGuides";
import { usePosterGrid } from "../grid/usePosterGrid";
import { isNavKey } from "../nav/useRailState";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { activeFiltersOf, pillsOf, type GenreOption } from "./libraryFilterModel";
import { yearSpanOf } from "./libraryFilterSheets";
import { useLibraryCatalogState } from "./useLibraryCatalogState";
import { useLibraryFilterBar } from "./useLibraryFilterBar";
import { useLibrarySheets } from "./useLibrarySheets";

type Params = RootStackParamList["Library"];

/** Moins d'affiches que ça, filtre de plateformes posé : la page suivante est
 *  demandée d'office — le filtre se pose sur ce qui est chargé, il doit voir
 *  tout le catalogue avant de dire « aucun titre ». */
const PLATFORM_SCAN_BELOW = 18;

const LOADING_ENTRY = "pill:status";
const goHome = () => railNavigate("Home");

/**
 * La bibliothèque, refondue (Apple TV) : son nom et son compte, la barre de
 * filtres façon Netflix (une pastille par critère, les filtres actifs dessous,
 * « Tout effacer »), les grandes listes par-dessus (dans une Modal : Menu les
 * ferme), puis la grille d'affiches, page après page. Mêmes filtres, mêmes
 * requêtes et même mémoire de session que l'écran d'Android TV
 * (`useLibraryFilters`, `catalogParams`) ; en plus : l'état d'erreur.
 *
 * L'arrivée vise la première affiche ; pendant un premier chargement, la
 * première pastille tient le focus, et la première affiche le reprend à son
 * arrivée si personne n'a bougé entre-temps.
 */
export function LibraryRedesign({ libraryId, libraryName }: Params) {
  const { t } = useTranslation();
  const lf = useLibraryFilters(libraryId);
  const catalog = useLibraryCatalogState(libraryId, lf.filters, lf.params);
  const { data: genreList } = useGenres(libraryId);
  const { data: libraries } = useLibraries();
  const genres = useMemo<GenreOption[]>(() => (genreList ?? []).map((g) => ({ id: g.Id, name: g.Name })), [genreList]);
  const title = libraries?.find((library) => library.Id === libraryId)?.Name ?? libraryName;
  const grid = usePosterGrid(catalog.items);

  const { items, loading, failed, hasMore, loadingMore, loadMore } = catalog;
  const platforms = hasPlatformFilter(lf.filters);
  const scanning = platforms && hasMore;
  const status: StatusPanelProps | null = failed
    ? {
        kind: "error",
        title: t("common:contentErrorTitle"),
        message: t("common:contentErrorMessage"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: catalog.retry },
        secondary: { label: t("common:backHome"), icon: "home", onPress: goHome },
      }
    : !loading && !scanning && items.length === 0 && !lf.hasActiveFilters
      ? { kind: "empty", title: t("library:emptyTitle"), message: t("library:emptyHint"), primary: { label: t("common:backHome"), icon: "home", onPress: goHome } }
      : null;
  const noResults = !status && !loading && !scanning && items.length === 0
    ? { title: t("library:emptyFilteredTitle"), message: t("library:emptyFilteredHint"), actionLabel: t("library:clearAll") }
    : null;

  const screen = useRedesignScreen({
    railKey: `Library_${libraryId}`,
    entryKey: status ? "status:primary" : loading ? LOADING_ENTRY : items.length > 0 ? "grid:0" : noResults ? "empty:primary" : LOADING_ENTRY,
  });
  const { focus } = screen;
  // Lié dès le premier rendu, avant que la vue ne monte son groupe.
  const bound = useRef(false);
  if (!bound.current) {
    focus.bind("filters", { container: AutoFocusGuide });
    bound.current = true;
  }

  const span = useMemo(() => yearSpanOf(catalog.loaded), [catalog.loaded]);
  const context = useMemo(() => ({ genres, resultCount: catalog.total ?? items.length, span }), [genres, catalog.total, items.length, span]);
  const sheets = useLibrarySheets(t, lf.filters, lf.update, focus, context);
  const active = useMemo(() => activeFiltersOf(t, lf.filters, genres), [t, lf.filters, genres]);
  const pills = useMemo(() => pillsOf(t, lf.filters, genres), [t, lf.filters, genres]);
  const labels = useMemo(() => ({ activeFilters: t("library:activeFilters"), clearAll: t("library:clearAll") }), [t]);
  const bar = useLibraryFilterBar(lf.update, active, focus, sheets.openSheet);

  useEffect(() => {
    if (platforms && hasMore && !loadingMore && items.length < PLATFORM_SCAN_BELOW) loadMore();
  }, [platforms, hasMore, loadingMore, items.length, loadMore]);

  // Premier chargement : la pastille de tête a tenu le focus ; les affiches
  // arrivées, la première le reprend — si personne n'a bougé entre-temps.
  const moved = useRef(false);
  useEffect(() => focus.subscribe((key, focused) => {
    if (focused && key !== LOADING_ENTRY && !isNavKey(key)) moved.current = true;
  }), [focus]);
  useEffect(() => {
    if (loading || items.length === 0 || moved.current || focus.focusedKey() !== LOADING_ENTRY) return;
    return focus.claim("grid:0");
  }, [loading, items.length, focus]);

  const onEndReached = useCallback(() => loadMore(), [loadMore]);

  return (
    <RedesignScreen screen={screen}>
      <LibraryView
        nav={screen.nav}
        title={title}
        count={loading ? t("library:loading") : t("library:titles", { count: catalog.total ?? items.length })}
        pills={pills}
        activeFilters={active}
        labels={labels}
        cards={grid.cards}
        palette={grid.palette}
        loading={loading}
        loadingMore={loadingMore}
        noResults={noResults}
        status={status}
        sheet={sheets.sheet}
        onPressPill={bar.onPressPill}
        onRemoveFilter={bar.onRemoveFilter}
        onClearAll={bar.onClearAll}
        onPressCard={grid.onPressCard}
        onLongPressCard={grid.onLongPressCard}
        onFocusCard={grid.onFocusCard}
        onEndReached={onEndReached}
        onSheetOption={sheets.onSheetOption}
        onSheetClear={sheets.onSheetClear}
        onSheetApply={sheets.onSheetApply}
        onSheetClose={sheets.closeSheet}
        onYearStep={sheets.onYearStep}
        onRatingSelect={sheets.onRatingSelect}
      />
      {grid.sheet}
    </RedesignScreen>
  );
}
