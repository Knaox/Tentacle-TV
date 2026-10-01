import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { EmptyState } from "../library/EmptyState";
import { GridSkeleton } from "../library/GridSkeleton";
import { PosterGrid } from "../library/PosterGrid";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { BrowseHeader, type BrowseKind } from "./BrowseHeader";

/**
 * Parcourir : la filmographie d'une personne, un genre ou un studio, DANS la
 * bibliothèque — une étagère, pas un catalogue. En tête, la croix Retour, le portrait
 * (ou le pictogramme du genre, du studio), le nom en grand et « N titres ·
 * ordre » ; puis la grille d'affiches. Le fond prend la lumière de l'affiche
 * focalisée ; la navigation garde « Rechercher » allumé (on vient de là).
 *
 * Contrat — tout arrive résolu :
 * - `useSearchBrowse(target, 120)` (`/api/search/person|genre|studio`) :
 *   `data.items` → `cards`, `data.total` → `meta`, `data.person` → portrait
 *   et initiales (`initials`), `isError` → `status`, pas encore de `data` →
 *   `loading` ; zéro titre → `empty` ;
 * - `personMeta` / `search:countTitles` et `search:sortedByYear` |
 *   `sortedByRating` pour `meta` ; `useCardMarkers`, `paletteFromBlurHash` ;
 * - `onBack` : `navigation.goBack()` (comme Retour et Menu), `onPressCard`
 *   vers la fiche, `onLongPressCard` vers la feuille (`useTVCardActions`).
 * L'arrivée du focus sur la première affiche reste à l'intégration.
 */

export interface BrowseViewProps {
  nav: NavRailProps;
  kind: BrowseKind;
  /** FILMOGRAPHIE, GENRE, STUDIO. */
  kicker: string;
  name: string;
  /** « 4 titres · Du plus récent au plus ancien ». */
  meta?: string;
  portraitUri?: string;
  initials?: string;
  cards: CardModel[];
  palette: ArtworkPalette;
  columns?: 5 | 6;
  loading?: boolean;
  /** Rien de cette personne, ce genre, ce studio dans la bibliothèque — la
   *  croix Retour reste la sortie, le vide n'en ajoute pas une deuxième. */
  empty?: { title: string; message?: string } | null;
  /** Erreur de chargement : le panneau remplace l'en-tête et la grille ; la
   *  croix reste à sa place, dans une bande à elle (groupe `browse:header`). */
  status?: StatusPanelProps | null;
  onBack?: () => void;
  onPressCard?: (card: CardModel) => void;
  onLongPressCard?: (card: CardModel) => void;
  onFocusCard?: (card: CardModel) => void;
}

export const BrowseView = memo(function BrowseView(props: BrowseViewProps) {
  const { nav, cards, palette, columns = 6, loading, empty, status } = props;
  const header = (
    <BrowseHeader
      kind={props.kind}
      kicker={props.kicker}
      name={props.name}
      meta={loading || empty ? undefined : props.meta}
      portraitUri={props.portraitUri}
      initials={props.initials}
      palette={palette}
      onBack={props.onBack}
    />
  );
  const placeholder = loading ? (
    <GridSkeleton columns={columns} rows={2} />
  ) : empty ? (
    <View style={styles.empty}>
      <EmptyState
        icon={props.kind === "person" ? "user" : props.kind === "genre" ? "tag" : "trailer"}
        title={empty.title}
        message={empty.message}
        palette={palette}
      />
    </View>
  ) : null;
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <>
          <StatusPanel {...status} />
          <FocusGroup focusKey="browse:header" style={styles.backBar}>
            <BackButton focusKey="browse:back" onPress={props.onBack} />
          </FocusGroup>
        </>
      ) : (
        <PosterGrid
          cards={loading ? [] : cards}
          columns={columns}
          header={header}
          empty={placeholder}
          onPressCard={props.onPressCard}
          onLongPressCard={props.onLongPressCard}
          onFocusCard={props.onFocusCard}
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
  empty: { paddingTop: 20 },
  // La place de la croix dans l'en-tête, sur toute la largeur du contenu : HAUT
  // depuis le panneau y monte.
  backBar: {
    position: "absolute",
    top: 0,
    left: TV_STAGE.contentLeft,
    right: 0,
    height: BACK_TOP + BACK_BUTTON_SIZE,
    paddingTop: BACK_TOP,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
