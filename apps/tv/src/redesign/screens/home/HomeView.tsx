import { memo, useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { HeroBanner, type HeroModel } from "../../hero/HeroBanner";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { MediaRow } from "../../rows/MediaRow";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";

/**
 * L'accueil : la carte héros plein format, puis les rangées dans l'ordre de
 * la mise en page du compte. La navigation flotte à gauche, la marque en
 * haut à droite, et le fond prend la lumière de ce qui a le focus.
 *
 * Contrat : tout arrive résolu. Alimenté plus tard par `useTVHomeRows`
 * (ordre des rangées), `useResumeItems` / `useFeaturedItems` (héros),
 * `useNextUp`, `useWatchlist`, `useLatestItems`, `useRecoPage` (cartes),
 * `useCardMarkers` (marqueurs) et `paletteFromBlurHash` (lumière).
 *
 * Une carte qui prend le focus amène sa rangée ENTIÈRE à l'écran — sa
 * légende et l'indication de l'appui long avec elle (`useForcedFocusReveal`) ;
 * au banc, la rangée de la clé figée.
 *
 * `filter` : la pastille du filtre de plateformes du compte, posée sur la
 * rangée `filterRowKey` — la première rangée recommandée réellement servie
 * (`useRecoFilterChipRow`). Un appui la retire (`onRemoveFilter`).
 *
 * `onHeroVisibleChange` dit quand le héros quitte l'écran — plus de la
 * moitié défilée — et quand il y revient : sa rotation s'y suspend.
 *
 * Clés de focus : `hero:primary`, `hero:secondary`, `hero:list`,
 * `<rangée>:<index>` pour les cartes, `filter:remove`, `status:primary`,
 * `status:secondary`, et `nav:<entrée>` pour la navigation.
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
  /** La pastille du filtre de plateformes (« Netflix · Disney+ »). */
  filter?: { label: string } | null;
  /** La rangée qui la porte. */
  filterRowKey?: string | null;
  onRemoveFilter?: () => void;
  onHeroPrimary?: () => void;
  onHeroSecondary?: () => void;
  /** Le rond « Ma liste » du héros. */
  onHeroToggleList?: () => void;
  onPressCard?: (rowKey: string, card: CardModel) => void;
  onLongPressCard?: (rowKey: string, card: CardModel) => void;
  onFocusCard?: (rowKey: string, card: CardModel) => void;
  /** Le héros quitte l'écran (plus de la moitié défilée) ou y revient. */
  onHeroVisibleChange?: (visible: boolean) => void;
}

const LEFT = TV_STAGE.contentLeft;
const HERO_WIDTH = 1920 - LEFT - 56;
/** Au-delà de ce défilement, plus de la moitié du héros est hors de l'écran. */
const HERO_HIDDEN_AFTER = TV_STAGE.hero.top + TV_STAGE.hero.height / 2;

export const HomeView = memo(function HomeView({
  nav,
  hero,
  rows,
  palette,
  status,
  filter,
  filterRowKey,
  onRemoveFilter,
  onHeroPrimary,
  onHeroSecondary,
  onHeroToggleList,
  onPressCard,
  onLongPressCard,
  onFocusCard,
  onHeroVisibleChange,
}: HomeViewProps) {
  const { scrollRef, sectionLayout, onViewportLayout, onScroll, revealSection } = useForcedFocusReveal();
  const heroVisible = useRef(true);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll(event);
      const visible = event.nativeEvent.contentOffset.y < HERO_HIDDEN_AFTER;
      if (visible === heroVisible.current) return;
      heroVisible.current = visible;
      onHeroVisibleChange?.(visible);
    },
    [onScroll, onHeroVisibleChange],
  );
  const onRowFocus = useCallback(
    (rowKey: string, card: CardModel) => {
      revealSection(rowKey);
      onFocusCard?.(rowKey, card);
    },
    [revealSection, onFocusCard],
  );
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <StatusPanel {...status} />
      ) : (
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onLayout={onViewportLayout}
          onScroll={handleScroll}
          scrollEventThrottle={32}
        >
          {hero ? (
            <View style={styles.hero} onLayout={sectionLayout("hero", ["hero"])}>
              <HeroBanner
                hero={hero}
                width={HERO_WIDTH}
                onPrimary={onHeroPrimary}
                onSecondary={onHeroSecondary}
                onToggleList={onHeroToggleList}
              />
            </View>
          ) : null}
          {rows.map((row, index) => (
            <HomeRow
              key={row.key}
              row={row}
              first={index === 0 ? (hero ? "afterHero" : "alone") : undefined}
              filterLabel={filter && row.key === filterRowKey ? filter.label : undefined}
              onLayout={sectionLayout(row.key, row.key === filterRowKey ? [row.key, "filter"] : [row.key])}
              onRemoveFilter={onRemoveFilter}
              onPressCard={onPressCard}
              onLongPressCard={onLongPressCard}
              onFocusCard={onRowFocus}
            />
          ))}
        </ScrollView>
      )}
      <View style={styles.brand} pointerEvents="none">
        <BrandMark size={52} />
      </View>
      <NavRail {...nav} />
    </View>
  );
});

type RowHandler = (rowKey: string, card: CardModel) => void;

/**
 * Une rangée, mémoïsée sur son modèle : quand seule la lumière du fond change
 * (une carte prend le focus), l'accueil se redessine sans redessiner ses
 * rangées — leurs rappels restent les mêmes d'un rendu à l'autre.
 */
const HomeRow = memo(function HomeRow({
  row,
  first,
  filterLabel,
  onLayout,
  onRemoveFilter,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: {
  row: HomeRowModel;
  /** La première rangée : son écart au héros, ou au haut de l'écran. */
  first?: "afterHero" | "alone";
  filterLabel?: string;
  onLayout: (event: LayoutChangeEvent) => void;
  onRemoveFilter?: () => void;
  onPressCard?: RowHandler;
  onLongPressCard?: RowHandler;
  onFocusCard?: RowHandler;
}) {
  const key = row.key;
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <View onLayout={onLayout} style={first === "afterHero" ? styles.firstAfterHero : first === "alone" ? styles.firstAlone : undefined}>
      <MediaRow
        rowKey={key}
        title={row.title}
        cards={row.cards}
        variant={row.variant}
        inset={LEFT}
        accessory={
          filterLabel ? (
            <Chip label={filterLabel} trailingIcon="close" size="md" selected focusKey="filter:remove" onPress={onRemoveFilter} />
          ) : undefined
        }
        onPressCard={onPressCard ? press : undefined}
        onLongPressCard={onLongPressCard ? longPress : undefined}
        onFocusCard={onFocusCard ? focus : undefined}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  scroll: { paddingBottom: 160 },
  hero: { marginLeft: LEFT, marginTop: TV_STAGE.hero.top },
  firstAfterHero: { marginTop: 56 },
  firstAlone: { marginTop: TV_STAGE.safe.y + 40 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
