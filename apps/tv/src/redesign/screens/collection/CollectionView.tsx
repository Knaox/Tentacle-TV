import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import type { IconName } from "../../icons/Icon";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { text } from "../../theme/tokens";
import { EmptyState } from "../library/EmptyState";
import { GridSkeleton } from "../library/GridSkeleton";
import { PosterGrid } from "../library/PosterGrid";
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
 */

export interface CollectionEmptyModel {
  icon: IconName;
  title: string;
  message: string;
  actionLabel: string;
}

export interface CollectionViewProps {
  nav: NavRailProps;
  /** « À regarder », « Vos coups de cœur ». */
  kicker?: string;
  title: string;
  /** « 12 titres ». */
  count?: string;
  cards: CardModel[];
  /** La lumière du fond : l'affiche focalisée, sinon la première. */
  palette: ArtworkPalette;
  columns?: 5 | 6;
  loading?: boolean;
  /** La collection est vide : pictogramme, titre, indice, action. */
  empty?: CollectionEmptyModel | null;
  /** Erreur de chargement : le panneau remplace la grille. */
  status?: StatusPanelProps | null;
  onEmptyAction?: () => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
}

function Header({ kicker, title, count }: { kicker?: string; title: string; count?: string }) {
  return (
    <View style={styles.header}>
      {kicker ? <Text style={text.kicker} numberOfLines={1}>{kicker}</Text> : null}
      <View style={styles.titleRow}>
        <Text style={text.title} numberOfLines={1}>{title}</Text>
        {count ? <Text style={[text.body, styles.count]} numberOfLines={1}>{count}</Text> : null}
      </View>
    </View>
  );
}

export const CollectionView = memo(function CollectionView({
  nav,
  kicker,
  title,
  count,
  cards,
  palette,
  columns = 6,
  loading,
  empty,
  status,
  onEmptyAction,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: CollectionViewProps) {
  const header = <Header kicker={kicker} title={title} count={loading || empty ? undefined : count} />;
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
      ) : (
        <PosterGrid
          cards={loading ? [] : cards}
          columns={columns}
          header={header}
          empty={placeholder}
          onPressCard={onPressCard}
          onLongPressCard={onLongPressCard}
          onFocusCard={onFocusCard}
        />
      )}
      <View style={styles.brand} pointerEvents="none">
        <BrandMark size={52} />
      </View>
      <NavRail {...nav} />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  header: { gap: 10, marginBottom: 44 },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: 22, paddingRight: 120 },
  count: { color: "rgba(255, 255, 255, 0.62)" },
  // Le vide occupe la hauteur restante de la scène, centré dedans.
  empty: { height: 1080 - TV_STAGE.safe.y * 2 - 190, justifyContent: "center" },
  statusHeader: { position: "absolute", left: TV_STAGE.contentLeft, top: TV_STAGE.safe.y },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
