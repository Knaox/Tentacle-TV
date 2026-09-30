import { memo, useCallback } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import { CARD_NOTE_SPACE } from "../../cards/CardFocusNote";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { HeroBanner, type HeroModel } from "../../hero/HeroBanner";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { MediaRow } from "../../rows/MediaRow";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";
import { ForYouNotice, type ForYouNoticeModel } from "./ForYouNotice";

/**
 * « Pour vous » : en tête, notre meilleure suggestion et POURQUOI (le
 * surtitre et sa raison) ; sous elle, la ligne d'état quand il y a lieu ;
 * puis les étagères de la bibliothèque, dans l'ordre du moteur — des
 * affiches, la raison de la recommandation sous la carte focalisée,
 * « Découverte » sur les titres d'exploration. La première étagère
 * porte la pastille du filtre de plateformes, qu'un appui retire. Le fond
 * prend la lumière de la carte focalisée.
 *
 * Contrat — tout arrive résolu :
 * - `hero` : `tvRecoHero(useRecoPage(useRecoSettings().providerFilter))`
 *   (tv-core), l'œuvre par `useMediaItem`, `kicker` = `reco:heroKicker`,
 *   `reason` = la première raison verbalisée (`reasonToText`) ;
 * - `shelves` : `tvRecoShelves(page, { hero })`, titres par `recoRowTitle`,
 *   cartes par `useCardMarkers` / `useRecoMarkerItem`, `badge` =
 *   `reco:explorationBadge` si `item.exploration`, `focusNote` = la raison ;
 * - `notice` : `tvRecoNotice` → `disabled` (`reco:tvDisabledHint`), `cold`
 *   (`reco:tvColdHint`) ; `preparing` et la page vide passent par `status` ;
 * - `filter` : le filtre du compte (`useRecoSettings().providerFilter`,
 *   noms par `familyOfProviderId`) ; `onRemoveFilter` →
 *   `useSaveRecoProviderFilter().mutate([])` ;
 * - `status` : chargement (`!page && !isError`), erreur (`isError`,
 *   Réessayer), en préparation, vide ;
 * - `palette` : `paletteFromBlurHash` de la carte focalisée, sinon du héros.
 */

export interface ForYouShelfModel {
  key: string;
  title: string;
  cards: CardModel[];
}

export interface ForYouFilterModel {
  /** « Netflix · Disney+ » (noms de marque, sans traduction). */
  label: string;
}

export interface ForYouViewProps {
  nav: NavRailProps;
  hero: HeroModel | null;
  notice?: ForYouNoticeModel | null;
  shelves: ForYouShelfModel[];
  filter?: ForYouFilterModel | null;
  palette: ArtworkPalette;
  /** Chargement, erreur, en préparation, vide : le panneau remplace la page. */
  status?: StatusPanelProps | null;
  onHeroPrimary?: () => void;
  onHeroSecondary?: () => void;
  onHeroToggleList?: () => void;
  onRemoveFilter?: () => void;
  onPressCard?: (shelfKey: string, card: CardModel) => void;
  onLongPressCard?: (shelfKey: string, card: CardModel) => void;
  onFocusCard?: (shelfKey: string, card: CardModel) => void;
}

const LEFT = TV_STAGE.contentLeft;
const HERO_WIDTH = 1920 - LEFT - 56;

export const ForYouView = memo(function ForYouView({
  nav,
  hero,
  notice,
  shelves,
  filter,
  palette,
  status,
  onHeroPrimary,
  onHeroSecondary,
  onHeroToggleList,
  onRemoveFilter,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: ForYouViewProps) {
  const { scrollRef, sectionLayout, onViewportLayout, onScroll, revealSection } = useForcedFocusReveal();
  // L'étagère d'une carte focalisée entière à l'écran : sa légende et la raison
  // de la carte avec elle (tvOS n'amène que la carte).
  const onShelfFocus = useCallback(
    (shelfKey: string, card: CardModel) => {
      revealSection(shelfKey);
      onFocusCard?.(shelfKey, card);
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
          onScroll={onScroll}
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
          {notice ? (
            <View style={hero ? styles.noticeAfterHero : styles.noticeAlone}>
              <ForYouNotice notice={notice} width={HERO_WIDTH} />
            </View>
          ) : null}
          {shelves.map((shelf, index) => (
            <Shelf
              key={shelf.key}
              shelf={shelf}
              first={index === 0 ? (hero || notice ? "afterHead" : "alone") : undefined}
              filterLabel={index === 0 && filter ? filter.label : undefined}
              onRemoveFilter={onRemoveFilter}
              onLayout={sectionLayout(shelf.key, index === 0 ? [shelf.key, "filter"] : [shelf.key])}
              onPressCard={onPressCard}
              onLongPressCard={onLongPressCard}
              onFocusCard={onShelfFocus}
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

type ShelfHandler = (shelfKey: string, card: CardModel) => void;

/**
 * Une étagère, mémoïsée sur son modèle : quand seule la lumière du fond
 * change (une carte prend le focus), la page se redessine sans redessiner
 * ses étagères — leurs rappels restent les mêmes d'un rendu à l'autre.
 */
const Shelf = memo(function Shelf({
  shelf,
  first,
  filterLabel,
  onRemoveFilter,
  onLayout,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: {
  shelf: ForYouShelfModel;
  first?: "afterHead" | "alone";
  filterLabel?: string;
  onRemoveFilter?: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onPressCard?: ShelfHandler;
  onLongPressCard?: ShelfHandler;
  onFocusCard?: ShelfHandler;
}) {
  const key = shelf.key;
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <View
      onLayout={onLayout}
      style={[
        first === "afterHead" && styles.firstAfterHead,
        first === "alone" && styles.firstAlone,
        shelf.cards.some((card) => card.focusNote) && styles.withNotes,
      ]}
    >
      <MediaRow
        rowKey={key}
        title={shelf.title}
        cards={shelf.cards}
        variant="poster"
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
  noticeAfterHero: { marginLeft: LEFT, marginTop: 48 },
  noticeAlone: { marginLeft: LEFT, marginTop: TV_STAGE.safe.y + 40 },
  firstAfterHead: { marginTop: 72 },
  firstAlone: { marginTop: TV_STAGE.safe.y + 72 },
  withNotes: { paddingBottom: CARD_NOTE_SPACE },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
