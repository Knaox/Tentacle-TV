import { memo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import { MORPH_NOTE_SPACE } from "../../cards/MorphCard";
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
 * puis les étagères de la bibliothèque, dans l'ordre du moteur — des cartes
 * qui se redressent en affiche au focus, la raison de la recommandation
 * dessous, « Découverte » sur les titres d'exploration. La première étagère
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
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
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
            <View
              key={shelf.key}
              onLayout={sectionLayout(shelf.key, index === 0 ? [shelf.key, "filter"] : [shelf.key])}
              style={[
                index === 0 && (hero || notice ? styles.firstAfterHead : styles.firstAlone),
                shelf.cards.some((card) => card.focusNote) && styles.withNotes,
              ]}
            >
              <MediaRow
                rowKey={shelf.key}
                title={shelf.title}
                cards={shelf.cards}
                variant="morph"
                inset={LEFT}
                accessory={
                  index === 0 && filter ? (
                    <Chip
                      label={filter.label}
                      trailingIcon="close"
                      size="md"
                      selected
                      focusKey="filter:remove"
                      onPress={onRemoveFilter}
                    />
                  ) : undefined
                }
                onPressCard={onPressCard ? (card) => onPressCard(shelf.key, card) : undefined}
                onLongPressCard={onLongPressCard ? (card) => onLongPressCard(shelf.key, card) : undefined}
                onFocusCard={onFocusCard ? (card) => onFocusCard(shelf.key, card) : undefined}
              />
            </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  scroll: { paddingBottom: 160 },
  hero: { marginLeft: LEFT, marginTop: TV_STAGE.hero.top },
  noticeAfterHero: { marginLeft: LEFT, marginTop: 48 },
  noticeAlone: { marginLeft: LEFT, marginTop: TV_STAGE.safe.y + 40 },
  firstAfterHead: { marginTop: 72 },
  firstAlone: { marginTop: TV_STAGE.safe.y + 72 },
  withNotes: { paddingBottom: MORPH_NOTE_SPACE },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
