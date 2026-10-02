import { memo, useMemo } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BRAND_CORNER_IN_SAFE_AREA, BrandCorner } from "../../brand/BrandCorner";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { FocusGroup } from "../../focus/FocusGroup";
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
 * liste) restent à l'intégration. Clé de groupe : `library:empty` — le vide
 * des filtres trop serrés, sur toute la largeur : « bas » depuis la barre y
 * trouve une cible, même loin de son bouton.
 *
 * La liste ouverte vit dans une `Modal` : son propre contrôleur de vue, où le
 * focus reste, et que Menu (Apple TV) ou Retour (Android) referme
 * (`onSheetClose`, sinon `onSheetApply`) sans quitter la bibliothèque.
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
  /** Menu ou Retour, liste ouverte : la refermer (défaut : `onSheetApply`). */
  onSheetClose?: () => void;
  onPressPill?: (key: LibraryFilterKey) => void;
  onRemoveFilter?: (id: string) => void;
  onClearAll?: () => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  onEndReached?: () => void;
}

const NO_CARDS: CardModel[] = [];

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
  const { onPressPill, onRemoveFilter, onClearAll } = props;
  // L'en-tête, le vide et le pied ne changent pas avec la lumière : la carte
  // focalisée la change à chaque pas du focus, et des éléments neufs à chaque
  // rendu redessinaient toute la grille — en-tête et barre de filtres compris
  // — à chaque carte traversée.
  const header = useMemo(
    () => (
      <View style={styles.header}>
        <PageTitle title={title} count={count} />
        {/* La marque, dans l'en-tête : elle défile avec lui. */}
        <BrandCorner anchor={BRAND_CORNER_IN_SAFE_AREA} />
        <FilterBar
          pills={pills}
          active={activeFilters}
          labels={labels}
          onPressPill={onPressPill}
          onRemoveFilter={onRemoveFilter}
          onClearAll={onClearAll}
        />
      </View>
    ),
    [title, count, pills, activeFilters, labels, onPressPill, onRemoveFilter, onClearAll],
  );
  // Le vide des filtres trop serrés prend la lumière : lui seul la suit.
  const emptyPalette = noResults ? palette : null;
  const empty = useMemo(
    () =>
      loading ? (
        <GridSkeleton columns={columns} rows={2} />
      ) : noResults && emptyPalette ? (
        <FocusGroup focusKey="library:empty" style={styles.noResults}>
          <EmptyState
            icon="sliders"
            title={noResults.title}
            message={noResults.message}
            palette={emptyPalette}
            primary={{ label: noResults.actionLabel, icon: "refresh", onPress: onClearAll }}
          />
        </FocusGroup>
      ) : null,
    [loading, columns, noResults, emptyPalette, onClearAll],
  );
  const footer = useMemo(
    () => (loadingMore ? <View style={styles.more}><GridSkeleton columns={columns} rows={1} /></View> : null),
    [loadingMore, columns],
  );
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <>
          <View style={styles.statusTitle}>
            <PageTitle title={title} />
          </View>
          <StatusPanel {...status} />
          <BrandCorner />
        </>
      ) : (
        <PosterGrid
          cards={loading ? NO_CARDS : cards}
          columns={columns}
          header={header}
          empty={empty}
          footer={footer}
          onPressCard={props.onPressCard}
          onLongPressCard={props.onLongPressCard}
          onFocusCard={props.onFocusCard}
          onEndReached={props.onEndReached}
        />
      )}
      <NavRail {...nav} />
      {sheet ? (
        // Sans animation de la Modal : la liste a déjà la sienne (voile, panneau).
        <Modal visible transparent animationType="none" onRequestClose={props.onSheetClose ?? props.onSheetApply}>
          <Sheet
            sheet={sheet}
            onSheetOption={props.onSheetOption}
            onSheetClear={props.onSheetClear}
            onSheetApply={props.onSheetApply}
            onYearStep={props.onYearStep}
            onRatingSelect={props.onRatingSelect}
          />
        </Modal>
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
});
