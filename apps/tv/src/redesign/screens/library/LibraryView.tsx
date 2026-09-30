import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { text } from "../../theme/tokens";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { ChoiceSheet } from "./ChoiceSheet";
import { EmptyState } from "./EmptyState";
import { FilterBar } from "./FilterBar";
import { GridSkeleton } from "./GridSkeleton";
import type { ActiveFilterModel, FilterPillModel, FilterSheetHandlers, FilterSheetModel, LibraryFilterKey } from "./libraryTypes";
import { PosterGrid } from "./PosterGrid";
import { RatingSheet } from "./RatingSheet";
import { SortSheet } from "./SortSheet";
import { YearSheet } from "./YearSheet";

/**
 * Une bibliothèque : son nom en grand et son nombre de titres, la barre de
 * filtres façon Netflix (une pastille par critère, les filtres actifs dessous,
 * « Tout effacer »), puis la grille de grandes affiches. Chaque pastille ouvre
 * sa grande liste en surimpression (`sheet`). Le fond prend la lumière de
 * l'affiche focalisée.
 *
 * Contrat — tout arrive résolu :
 * - `useLibraries` (nom, type), `useLibraryCatalog(libraryId, lf.params)`
 *   (cartes, `TotalRecordCount` → `count`, pages → `onEndReached`,
 *   `isFetchingNextPage` → `loadingMore`, `isLoading` → `loading`,
 *   `isError` → `status`) ;
 * - `useLibraryFilters(libraryId)` : l'état des filtres, mis en mots pour
 *   `pills`, `activeFilters` et `sheet` ; ses setters derrière `onPressPill`
 *   (Favoris : `setIsFavorite`), `onRemoveFilter`, `onClearAll`
 *   (`resetFilters`), `onSheetOption` (`toggleGenre`, `togglePlatform`,
 *   `setStatusFilter`, `setSortBy` + `setSortOrder`, décennies →
 *   `setYearFrom` / `setYearTo`), `onYearStep`, `onRatingSelect`
 *   (`setRatingMin`), `onSheetClear` ;
 * - `useGenres(libraryId)` (options de Genres), `PLATFORMS` +
 *   `usePlatformFilter` (options et filtrage de Plateformes) ;
 * - `useCardMarkers` (marqueurs), `paletteFromBlurHash` (lumière).
 * Retour et focus (entrée sur la grille, retour à la pastille qui a ouvert une
 * liste) restent à l'intégration.
 */

export interface LibraryViewProps extends FilterSheetHandlers {
  nav: NavRailProps;
  title: string;
  /** « 312 titres » (ou « Chargement du catalogue… »). */
  count?: string;
  pills: FilterPillModel[];
  activeFilters: ActiveFilterModel[];
  labels: { activeFilters: string; clearAll: string };
  cards: CardModel[];
  /** La lumière du fond : l'affiche focalisée, sinon la première. */
  palette: ArtworkPalette;
  columns?: 5 | 6;
  /** Premier chargement : affiches fantômes, barre de filtres en place. */
  loading?: boolean;
  /** Page suivante en route : une rangée fantôme au bas de la grille. */
  loadingMore?: boolean;
  /** Filtres trop serrés : aucun titre, et de quoi les desserrer. */
  noResults?: { title: string; message: string; actionLabel: string } | null;
  /** Bibliothèque vide ou erreur : le panneau remplace barre et grille. */
  status?: StatusPanelProps | null;
  /** La liste en surimpression ouverte, ou rien. */
  sheet?: FilterSheetModel | null;
  onPressPill?: (key: LibraryFilterKey) => void;
  onRemoveFilter?: (id: string) => void;
  onClearAll?: () => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  onEndReached?: () => void;
}

function Sheet({ sheet, ...handlers }: { sheet: FilterSheetModel } & FilterSheetHandlers) {
  switch (sheet.kind) {
    case "choice":
      return <ChoiceSheet sheet={sheet} {...handlers} />;
    case "sort":
      return <SortSheet sheet={sheet} {...handlers} />;
    case "years":
      return <YearSheet sheet={sheet} {...handlers} />;
    case "rating":
      return <RatingSheet sheet={sheet} {...handlers} />;
  }
}

function PageTitle({ title, count }: { title: string; count?: string }) {
  return (
    <View style={styles.titleRow}>
      <Text style={text.title} numberOfLines={1}>{title}</Text>
      {count ? <Text style={[text.body, styles.count]} numberOfLines={1}>{count}</Text> : null}
    </View>
  );
}

export const LibraryView = memo(function LibraryView(props: LibraryViewProps) {
  const { nav, title, count, pills, activeFilters, labels, cards, palette, columns = 6, loading, loadingMore, noResults, status, sheet } = props;
  const header = (
    <View style={styles.header}>
      <PageTitle title={title} count={count} />
      <FilterBar
        pills={pills}
        active={activeFilters}
        labels={labels}
        onPressPill={props.onPressPill}
        onRemoveFilter={props.onRemoveFilter}
        onClearAll={props.onClearAll}
      />
    </View>
  );
  const empty = loading ? (
    <GridSkeleton columns={columns} rows={2} />
  ) : noResults ? (
    <View style={styles.noResults}>
      <EmptyState
        icon="sliders"
        title={noResults.title}
        message={noResults.message}
        palette={palette}
        primary={{ label: noResults.actionLabel, icon: "refresh", onPress: props.onClearAll }}
      />
    </View>
  ) : null;
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <>
          <View style={styles.statusTitle}>
            <PageTitle title={title} />
          </View>
          <StatusPanel {...status} />
        </>
      ) : (
        <PosterGrid
          cards={loading ? [] : cards}
          columns={columns}
          header={header}
          empty={empty}
          footer={loadingMore ? <View style={styles.more}><GridSkeleton columns={columns} rows={1} /></View> : null}
          onPressCard={props.onPressCard}
          onLongPressCard={props.onLongPressCard}
          onFocusCard={props.onFocusCard}
          onEndReached={props.onEndReached}
        />
      )}
      <View style={styles.brand} pointerEvents="none">
        <BrandMark size={52} />
      </View>
      <NavRail {...nav} />
      {sheet ? (
        <Sheet
          sheet={sheet}
          onSheetOption={props.onSheetOption}
          onSheetClear={props.onSheetClear}
          onSheetApply={props.onSheetApply}
          onYearStep={props.onYearStep}
          onRatingSelect={props.onRatingSelect}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { gap: 30, marginBottom: 44 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 22, paddingRight: 120 },
  count: { color: "rgba(255, 255, 255, 0.62)" },
  statusTitle: { position: "absolute", left: TV_STAGE.contentLeft, top: TV_STAGE.safe.y },
  noResults: { paddingTop: 40, paddingRight: 0 },
  more: { marginTop: 40 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
