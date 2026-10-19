import { memo, useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BELOW_ZONE_VIEWPORT } from "@tentacle-tv/tv-core";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { useAmbientOf, type AmbientSource } from "../../background/ambientSource";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { FocusGroup } from "../../focus/FocusGroup";
import type { IconName } from "../../icons/Icon";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { OpenRowsBody } from "../../openRow/OpenRowsBody";
import { text } from "../../theme/tokens";
import { EmptyState } from "../library/EmptyState";
import { FilterBar } from "../library/FilterBar";
import { FilterSheetLayer, type FilterSheetLayerProps } from "../library/FilterSheetLayer";
import { GridSkeleton } from "../library/GridSkeleton";
import type { ActiveFilterModel, FilterPillModel, LibraryFilterKey } from "../library/libraryTypes";
import { PosterGrid, useGridColumns } from "../library/PosterGrid";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";

/**
 * Ma liste, Favoris : une page de collection — le surtitre, le titre en
 * grand et le compte, puis TOUTE la collection en grandes affiches. Vide, elle
 * dit comment la remplir et offre une sortie (« Parcourir les
 * bibliothèques ») : sans rien de focalisable, la télécommande serait muette.
 *
 * Contrat — tout arrive résolu :
 * - `useWatchlistAll()` (Ma liste, `Filters=Likes`) ou `useFavoritesAll()`
 *   (Favoris, `Filters=IsFavorite`) : `data` → `cards` et `count`,
 *   `isLoading` → `loading`, `isError` → `status` ;
 * - `useCardMarkers` (marqueurs), `paletteFromBlurHash` (lumière) ;
 * - `onEmptyAction` : la navigation vers l'accueil (ou les bibliothèques),
 *   `onPressCard` vers la fiche, `onLongPressCard` vers la feuille
 *   (`useTVCardActions`), le retour de `onFocusCard` vers la lumière du fond.
 * L'entrée du focus (première affiche, sinon l'action du vide) reste à
 * l'intégration (`useTVContentEntry`).
 *
 * Sous le titre, avec des titres seulement, la barre de la bibliothèque
 * réduite au TYPE et au TRI (`pills`, `activeFilters`, CO-3) — mêmes
 * pastilles, mêmes listes en Modal (`FilterSheetLayer`), mêmes clés de
 * focus ; un type sans titre : « Aucun titre ne correspond » (`noResults`,
 * groupe `library:empty`, CO-4).
 */

export interface CollectionEmptyModel {
  icon: IconName;
  title: string;
  message: string;
  actionLabel: string;
}

export interface CollectionViewProps extends FilterSheetLayerProps {
  nav: NavRailProps;
  /** « À regarder », « Vos coups de cœur ». */
  kicker?: string;
  title: string;
  /** « 12 titres ». */
  count?: string;
  cards: CardModel[];
  /** La lumière du fond : l'affiche focalisée, sinon la première. */
  palette: ArtworkPalette;
  /** La lumière de l'affiche focalisée (`ambientSource`) : la vue la suit, l'écran câblé ne se redessine pas. */
  ambient?: AmbientSource;
  /** Colonnes de la grille ; absentes : celles de la taille des cartes réglée (`useCardMetrics`). */
  columns?: number;
  loading?: boolean;
  /** La collection est vide : pictogramme, titre, indice, action. */
  empty?: CollectionEmptyModel | null;
  /** Erreur de chargement : le panneau remplace la grille. */
  status?: StatusPanelProps | null;
  onEmptyAction?: () => void;
  /** La barre (Type, Trier par) ; absente, la page n'en a pas. */
  pills?: FilterPillModel[];
  activeFilters?: ActiveFilterModel[];
  filterLabels?: { activeFilters: string; clearAll: string };
  /** Le type retenu ne garde aucun titre : de quoi l'effacer. */
  noResults?: { title: string; message: string; actionLabel: string } | null;
  onPressPill?: (key: LibraryFilterKey) => void;
  onRemoveFilter?: (id: string) => void;
  onClearAll?: () => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
  /** EN RANGÉES (la carte qui s'ouvre, « Ranger par ») : les rangées, à la place de la grille. */
  rows?: ReactNode;
}

function Header({ kicker, title, count }: { kicker?: string; title: string; count?: string }) {
  return (
    <View style={styles.titleBlock}>
      {kicker ? <Text style={text.kicker} numberOfLines={1}>{kicker}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={text.title} numberOfLines={1}>{title}</Text>
        {count ? <Text style={[text.body, styles.count]} numberOfLines={1}>{count}</Text> : null}
      </View>
    </View>
  );
}

const NO_CARDS: CardModel[] = [];
const NO_ACTIVE: ActiveFilterModel[] = [];

export const CollectionView = memo(function CollectionView(props: CollectionViewProps) {
  const { nav, kicker, title, count, cards, ambient, loading, empty, status, noResults, onEmptyAction, pills, filterLabels } = props;
  const { onPressPill, onRemoveFilter, onClearAll } = props;
  const activeFilters = props.activeFilters ?? NO_ACTIVE;
  const palette = useAmbientOf(ambient, props.palette);
  const columns = useGridColumns(props.columns);
  // La barre ne vaut qu'avec des titres : ni chargement, ni vide (CO-3).
  const showBar = !loading && !empty;
  // L'en-tête ne suit pas la lumière : la carte focalisée la change à chaque
  // pas, et un en-tête neuf redessinait la grille entière (cf. `LibraryView`).
  const header = useMemo(
    () => (
      <View style={showBar && pills ? styles.headerWithBar : styles.header}>
        <Header kicker={kicker} title={title} count={loading || empty ? undefined : count} />
        {showBar && pills && filterLabels ? (
          <FilterBar
            pills={pills}
            active={activeFilters}
            labels={filterLabels}
            onPressPill={onPressPill}
            onRemoveFilter={onRemoveFilter}
            onClearAll={onClearAll}
          />
        ) : null}
      </View>
    ),
    [kicker, title, count, loading, empty, showBar, pills, filterLabels, activeFilters, onPressPill, onRemoveFilter, onClearAll],
  );
  const placeholder = loading ? (
    <GridSkeleton columns={columns} rows={2} />
  ) : empty ? (
    <View style={styles.empty}>
      <EmptyState
        icon={empty.icon}
        title={empty.title}
        message={empty.message}
        palette={palette}
        primary={{ label: empty.actionLabel, onPress: onEmptyAction }}
      />
    </View>
  ) : noResults ? (
    <FocusGroup focusKey="library:empty" style={styles.noResults}>
      <EmptyState
        icon="sliders"
        title={noResults.title}
        message={noResults.message}
        palette={palette}
        primary={{ label: noResults.actionLabel, icon: "refresh", onPress: onClearAll }}
      />
    </FocusGroup>
  ) : null;
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <>
          <View style={styles.statusHeader}>
            <Header kicker={kicker} title={title} />
          </View>
          <StatusPanel {...status} />
        </>
      ) : props.rows !== undefined ? (
        <OpenRowsBody header={header} empty={placeholder}>{props.rows}</OpenRowsBody>
      ) : (
        <PosterGrid
          cards={loading ? NO_CARDS : cards}
          columns={columns}
          header={header}
          empty={placeholder}
          onPressCard={props.onPressCard}
          onLongPressCard={props.onLongPressCard}
          onFocusCard={props.onFocusCard}
        />
      )}
      <NavRail {...nav} />
      <FilterSheetLayer
        sheet={props.sheet}
        onSheetClose={props.onSheetClose}
        onSheetExited={props.onSheetExited}
        onSheetOption={props.onSheetOption}
        onSheetClear={props.onSheetClear}
        onSheetApply={props.onSheetApply}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  titleBlock: { gap: 10 },
  header: { marginBottom: 44 },
  // Avec la barre : le titre, puis les pastilles (l'écart de la bibliothèque).
  headerWithBar: { gap: 30, marginBottom: 44 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 22 },
  count: { color: "rgba(255, 255, 255, 0.62)" },
  // Le vide occupe la hauteur restante de la fenêtre sous la zone de l'aperçu, centré dedans.
  empty: { height: BELOW_ZONE_VIEWPORT - TV_STAGE.safe.y * 2 - 190, justifyContent: "center" },
  noResults: { paddingTop: 40 },
  statusHeader: { position: "absolute", left: TV_STAGE.contentLeft, top: TV_STAGE.safe.y },
});
