import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useGenres, useLibraries } from "@tentacle-tv/api-client";
import { GRID_FIRST_KEY, libraryEntryKey } from "@tentacle-tv/tv-core";
import { useLibraryFilters } from "../../hooks/useLibraryFilters";
import { railNavigate } from "../../navigation/railNavigate";
import type { RootStackParamList } from "../../navigation/types";
import { useLibraryGroups, useLibraryLoadReprise } from "../../platform/tvos/screens/library";
import { RENDER } from "../../redesign/render/renderProfile";
import { LibraryView } from "../../redesign/screens/library/LibraryView";
import type { StatusPanelProps } from "../../redesign/screens/shared/StatusPanel";
import { LibraryGroupRows, groupRowKey } from "../groups/LibraryGroupRows";
import { useLibraryRowGroups } from "../groups/useLibraryRowGroups";
import { useRowCardActions } from "../groups/useRowCardActions";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useHeldWhile } from "../screen/useHeldWhile";
import { useRedesignScreen } from "../screen/useRedesignScreen";
import { activeFiltersOf, pillsOf, type GenreOption } from "./libraryFilterModel";
import { yearSpanOf } from "./libraryFilterSheets";
import { usePerfReady } from "../../platform/perf";
import { useLibraryFilterBar } from "./useLibraryFilterBar";
import { useLibrarySheets } from "./useLibrarySheets";
import { NEUTRAL_PALETTE } from "../../redesign/color/artworkPalette";

type Params = RootStackParamList["Library"];

/** Android TV : la page sous une liste de filtres ne suit pas chaque coche
 *  (profil `holdUnderPanels`) ; l'Apple TV la redessine comme avant. */
const HOLD_UNDER_SHEET = RENDER.holdUnderPanels;

const goHome = () => railNavigate("Home");
const NO_SPAN: never[] = [];
const NO_CARDS: never[] = [];

/**
 * La bibliothèque, refondue (Apple TV, Android TV) — EN RANGÉES depuis la
 * carte qui s'ouvre (banc validé par Damien le 19/10) : son nom et son
 * compte, la barre de filtres façon Netflix — « Ranger par » en tête (genre,
 * décennie, lettres, note) —, puis une rangée par groupe, la carte focalisée
 * ouverte en 16:9 au bord gauche, la même taille de carte que l'Accueil
 * (`LibraryGroupRows`, tv-core `groups/libraryGroups.ts`). Les filtres
 * s'appliquent dans chaque rangée ; mêmes filtres et même mémoire de session
 * qu'avant (`useLibraryFilters`).
 *
 * L'arrivée vise la première carte de la première rangée ; pendant un premier
 * chargement, la pastille de tête tient le focus, et la première carte le
 * reprend à son arrivée si personne n'a bougé entre-temps (tv-core
 * `focus/libraryFocus.ts`, posé par `platform/tvos/screens/library.ts`).
 */
export function LibraryRedesign({ libraryId, libraryName }: Params) {
  const { t } = useTranslation();
  const lf = useLibraryFilters(libraryId);
  const { data: genreList } = useGenres(libraryId);
  const { data: libraries } = useLibraries();
  const genres = useMemo<GenreOption[] | undefined>(() => genreList?.map((g) => ({ id: g.Id, name: g.Name })), [genreList]);
  const title = libraries?.find((library) => library.Id === libraryId)?.Name ?? libraryName;
  const rows = useLibraryRowGroups(libraryId, lf.filters, genres);
  const actions = useRowCardActions();

  const { groups, total } = rows;
  const loading = groups === null && !rows.failed;
  const nothing = !loading && (groups?.length ?? 0) === 0;
  const status: StatusPanelProps | null = rows.failed
    ? {
        kind: "error",
        title: t("common:contentErrorTitle"),
        message: t("common:contentErrorMessage"),
        primary: { label: t("common:retry"), icon: "refresh", onPress: rows.retry },
        secondary: { label: t("common:backHome"), icon: "home", onPress: goHome },
      }
    : nothing && !lf.hasActiveFilters
      ? { kind: "empty", title: t("library:emptyTitle"), message: t("library:emptyHint"), primary: { label: t("common:backHome"), icon: "home", onPress: goHome } }
      : null;
  const noResults = !status && nothing
    ? { title: t("library:emptyFilteredTitle"), message: t("library:emptyFilteredHint"), actionLabel: t("library:clearAll") }
    : null;

  const first = groups?.[0] ? `${groupRowKey(groups[0])}:0` : GRID_FIRST_KEY;
  const screen = useRedesignScreen({
    railKey: `Library_${libraryId}`,
    entryKey: libraryEntryKey({ status: status !== null, loading, items: groups?.length ?? 0, noResults: noResults !== null }, first),
    rewindRows: true,
  });
  const { focus } = screen;
  useLibraryGroups(focus);

  const context = useMemo(() => ({ genres: genres ?? [], resultCount: total ?? 0, span: yearSpanOf(NO_SPAN) }), [genres, total]);
  const sheets = useLibrarySheets(t, lf.filters, lf.update, focus, context);
  const active = useMemo(() => activeFiltersOf(t, lf.filters, genres ?? []), [t, lf.filters, genres]);
  const pills = useMemo(() => pillsOf(t, lf.filters, genres ?? []), [t, lf.filters, genres]);
  const labels = useMemo(() => ({ activeFilters: t("library:activeFilters"), clearAll: t("library:clearAll") }), [t]);
  const bar = useLibraryFilterBar(lf.update, active, focus, sheets.openSheet, first);

  useLibraryLoadReprise(focus, { loading, items: groups?.length ?? 0 }, first);
  // Le mode de mesure (Android TV, éteint par défaut) : la bibliothèque est prête.
  usePerfReady("bibliothèque", !loading);

  // Ce que la liste ouverte COUVRE reste tel quel jusqu'à la fin de son fondu
  // de sortie (Android TV) : une coche ne redessine que la liste.
  const under = useHeldWhile(
    {
      count: loading ? t("library:loading") : t("library:titles", { count: total ?? 0 }),
      pills,
      active,
      groups,
      base: rows.base,
      loading,
      noResults,
      status,
    },
    HOLD_UNDER_SHEET && sheets.covering,
  );
  const rowsNode = useMemo(
    () => (under.groups ? <LibraryGroupRows libraryId={libraryId} groups={under.groups} base={under.base} platformIds={lf.filters.platformIds} actions={actions} /> : null),
    [libraryId, under.groups, under.base, lf.filters.platformIds, actions],
  );

  return (
    <RedesignScreen screen={screen}>
      <LibraryView
        nav={screen.nav}
        title={title}
        count={under.count}
        pills={under.pills}
        activeFilters={under.active}
        labels={labels}
        cards={NO_CARDS}
        rows={rowsNode}
        palette={NEUTRAL_PALETTE}
        ambient={actions.ambient}
        loading={under.loading}
        noResults={under.noResults}
        status={under.status}
        sheet={sheets.sheet}
        onPressPill={bar.onPressPill}
        onRemoveFilter={bar.onRemoveFilter}
        onClearAll={bar.onClearAll}
        onSheetOption={sheets.onSheetOption}
        onSheetClear={sheets.onSheetClear}
        onSheetApply={sheets.onSheetApply}
        onSheetClose={sheets.closeSheet}
        onSheetExited={sheets.onSheetExited}
        onYearStep={sheets.onYearStep}
        onRatingSelect={sheets.onRatingSelect}
      />
      {actions.sheet}
    </RedesignScreen>
  );
}
