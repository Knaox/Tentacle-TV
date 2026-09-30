import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { HeroBanner, type HeroModel } from "../../hero/HeroBanner";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { MediaRow } from "../../rows/MediaRow";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";

/**
 * L'accueil : la carte héros plein format, puis les rangées dans l'ordre de
 * la mise en page du compte. La navigation flotte à gauche, la marque en
 * haut à droite, et le fond prend la lumière de ce qui a le focus.
 *
 * Contrat : tout arrive résolu. Alimenté plus tard par `useTVHomeRows`
 * (ordre des rangées), `useResumeItems` / `useFeaturedItems` (héros),
 * `useNextUp`, `useWatchlist`, `useLatestItems`, `useRecoPage` (cartes),
 * `useCardMarkers` (marqueurs) et `paletteFromBlurHash` (lumière).
 */

export interface HomeRowModel {
  key: string;
  title: string;
  variant: "landscape" | "poster" | "morph";
  cards: CardModel[];
}

export interface HomeViewProps {
  nav: NavRailProps;
  hero: HeroModel | null;
  rows: HomeRowModel[];
  /** La lumière du fond : celle de la carte focalisée, sinon du héros. */
  palette: ArtworkPalette;
  /** Chargement, erreur, accueil vide : le panneau remplace le contenu. */
  status?: StatusPanelProps | null;
  onHeroPrimary?: () => void;
  onHeroSecondary?: () => void;
  onPressCard?: (rowKey: string, card: CardModel) => void;
  onLongPressCard?: (rowKey: string, card: CardModel) => void;
  onFocusCard?: (rowKey: string, card: CardModel) => void;
}

const LEFT = TV_STAGE.contentLeft;
const HERO_WIDTH = 1920 - LEFT - 56;

export const HomeView = memo(function HomeView({
  nav,
  hero,
  rows,
  palette,
  status,
  onHeroPrimary,
  onHeroSecondary,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: HomeViewProps) {
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <StatusPanel {...status} />
      ) : (
        <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {hero ? (
            <View style={styles.hero}>
              <HeroBanner hero={hero} width={HERO_WIDTH} onPrimary={onHeroPrimary} onSecondary={onHeroSecondary} />
            </View>
          ) : null}
          <View style={hero ? styles.rowsAfterHero : styles.rowsAlone}>
            {rows.map((row) => (
              <MediaRow
                key={row.key}
                rowKey={row.key}
                title={row.title}
                cards={row.cards}
                variant={row.variant}
                inset={LEFT}
                onPressCard={onPressCard ? (card) => onPressCard(row.key, card) : undefined}
                onLongPressCard={onLongPressCard ? (card) => onLongPressCard(row.key, card) : undefined}
                onFocusCard={onFocusCard ? (card) => onFocusCard(row.key, card) : undefined}
              />
            ))}
          </View>
        </ScrollView>
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
  fill: { flex: 1 },
  scroll: { paddingBottom: 160 },
  hero: { marginLeft: LEFT, marginTop: TV_STAGE.hero.top },
  rowsAfterHero: { marginTop: 56 },
  rowsAlone: { marginTop: TV_STAGE.safe.y + 40 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
