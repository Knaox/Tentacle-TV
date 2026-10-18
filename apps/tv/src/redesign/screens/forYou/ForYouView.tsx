import { memo, useCallback, useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BELOW_ZONE_ANCHOR_TOP, BELOW_ZONE_REVEAL } from "@tentacle-tv/tv-core";
import { LiveAmbientBackdrop } from "../../background/AmbientBackdrop";
import type { AmbientSource } from "../../background/ambientSource";
import { CARD_NOTE_SPACE } from "../../cards/CardFocusNote";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import type { HeroModel } from "../../hero/HeroBanner";
import { HeroZone } from "../../previewZone/HeroZone";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { BelowZonePage, useBelowZoneBottomRoom } from "../../rows/BelowZonePage";
import { MEDIA_ROW_TRAILING, MediaRow } from "../../rows/MediaRow";
import { useRowRewindPort } from "../../rows/rowRewindPort";
import { RowStageProvider } from "../../rows/rowStage";
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
 * - `hero` : `tvRecoHero(useRecoPageVisit(useRecoSettings().providerFilter))`
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
 * - `palette` : `paletteFromBlurHash` du héros (ou de la première carte) ;
 *   `ambient` : celle de la carte focalisée, que le fond suit seul.
 *
 * La page est À ZONE (`BelowZonePage`, tv-core `previewZoneLayout.ts`) : en
 * haut, la zone fixe de l'aperçu (`zone`), dessous, la page qui défile. Le
 * héros et chaque étagère sont des SECTIONS (`FocusSection`, clés
 * `section:hero`, `section:<étagère>`) : HAUT / BAS passe à la voisine, au plus
 * proche ; l'étagère focalisée se pose TOUJOURS au même endroit, juste sous la
 * zone, en un seul mouvement. Une étagère revient
 * au début une fois sortie de l'écran : la page dit au port des rangées
 * (`rowRewindPort`) où elles sont et qu'elle défile.
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
  /** La lumière de la carte focalisée, que le fond suit seul (`ambientSource`). */
  ambient?: AmbientSource;
  /** Chargement, erreur, en préparation, vide : le panneau remplace la page. */
  status?: StatusPanelProps | null;
  onHeroPrimary?: () => void;
  onHeroSecondary?: () => void;
  onHeroToggleList?: () => void;
  onRemoveFilter?: () => void;
  onPressCard?: (shelfKey: string, card: CardModel) => void;
  onLongPressCard?: (shelfKey: string, card: CardModel) => void;
  onFocusCard?: (shelfKey: string, card: CardModel) => void;
  /** La zone fixe de l'aperçu, en haut (`BelowZonePage`). */
  zone?: ReactNode;
}

const LEFT = TV_STAGE.contentLeft;
const HERO_WIDTH = 1920 - LEFT - 56;
/** Une étagère se pose toujours au même endroit, sous la zone (tv-core `previewZoneLayout.ts`). */
const SHELF_REVEAL: FocusSectionReveal = BELOW_ZONE_REVEAL;

export const ForYouView = memo(function ForYouView({
  nav,
  hero,
  notice,
  shelves,
  filter,
  palette,
  ambient,
  status,
  onHeroPrimary,
  onHeroSecondary,
  onHeroToggleList,
  onRemoveFilter,
  onPressCard,
  onLongPressCard,
  onFocusCard,
  zone,
}: ForYouViewProps) {
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  const rewind = useRowRewindPort();
  // La dernière étagère se pose sous la zone comme les autres : la marge du bas qu'il lui faut.
  const bottom = useBelowZoneBottomRoom(SCROLL_BOTTOM);
  const scrollContent = useMemo(() => ({ paddingTop: BELOW_ZONE_ANCHOR_TOP, paddingBottom: bottom.room }), [bottom.room]);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      rewind?.scroll(contentOffset.y, layoutMeasurement.height);
    },
    [rewind],
  );
  return (
    <View style={styles.root}>
      <LiveAmbientBackdrop source={ambient} palette={palette} />
      {status ? (
        <StatusPanel {...status} />
      ) : (
        <RowStageProvider>
          <BelowZonePage
            zone={
              zone ?? (
                // Le héros vit dans la zone d'aperçu ; sans lui, la première carte en est le repli.
                <HeroZone hero={hero} fallback={shelves[0]?.cards[0] ?? null} onPrimary={onHeroPrimary} onSecondary={onHeroSecondary} onToggleList={onHeroToggleList} />
              )
            }
          >
            <ScrollView
              ref={scrollRef}
              style={styles.fill}
              contentContainerStyle={scrollContent}
              showsVerticalScrollIndicator={false}
              onLayout={onViewportLayout}
              onScroll={onScroll}
              scrollEventThrottle={32}
            >
              {notice ? (
                <View style={styles.noticeAlone}>
                  <ForYouNotice notice={notice} width={HERO_WIDTH} />
                </View>
              ) : null}
              {shelves.map((shelf, index) => (
                <Shelf
                  key={shelf.key}
                  shelf={shelf}
                  rank={index}
                  first={index === 0 ? (notice ? "afterHead" : "alone") : undefined}
                  filterLabel={index === 0 && filter ? filter.label : undefined}
                  onRemoveFilter={onRemoveFilter}
                  onLayout={sectionLayout(shelf.key, index === 0 ? [shelf.key, "filter"] : [shelf.key])}
                  onMeasureLast={index === shelves.length - 1 ? bottom.onLastLayout : undefined}
                  onPressCard={onPressCard}
                  onLongPressCard={onLongPressCard}
                  onFocusCard={onFocusCard}
                />
              ))}
            </ScrollView>
          </BelowZonePage>
        </RowStageProvider>
      )}
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
  rank,
  first,
  filterLabel,
  onRemoveFilter,
  onLayout,
  onMeasureLast,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: {
  shelf: ForYouShelfModel;
  /** Sa place dans la page : son tour dans le montage échelonné (`rowStage`). */
  rank: number;
  first?: "afterHead" | "alone";
  filterLabel?: string;
  onRemoveFilter?: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  /** La dernière étagère : sa hauteur fait la marge du bas de la page (`useBelowZoneBottomRoom`). */
  onMeasureLast?: (event: LayoutChangeEvent) => void;
  onPressCard?: ShelfHandler;
  onLongPressCard?: ShelfHandler;
  onFocusCard?: ShelfHandler;
}) {
  const key = shelf.key;
  const withNotes = shelf.cards.some((card) => card.focusNote);
  const rewind = useRowRewindPort();
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout(event);
      onMeasureLast?.(event);
      // Sous les cartes : la marge de la rangée, et la place de la raison (montrée au focus seulement).
      const { y, height } = event.nativeEvent.layout;
      rewind?.layout(key, y, height - MEDIA_ROW_TRAILING - (withNotes ? CARD_NOTE_SPACE : 0));
    },
    [onLayout, onMeasureLast, rewind, key, withNotes],
  );
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <FocusSection
      focusKey={`section:${key}`}
      reveal={SHELF_REVEAL}
      rowReveal
      onLayout={layout}
      style={[
        first === "afterHead" && styles.firstAfterHead,
        first === "alone" && styles.firstAlone,
        withNotes && styles.withNotes,
      ]}
    >
      <MediaRow
        rowKey={key}
        title={shelf.title}
        cards={shelf.cards}
        variant="poster"
        inset={LEFT}
        stageRank={rank}
        accessory={
          filterLabel ? (
            <Chip label={filterLabel} trailingIcon="close" size="md" selected focusKey="filter:remove" onPress={onRemoveFilter} />
          ) : undefined
        }
        onPressCard={onPressCard ? press : undefined}
        onLongPressCard={onLongPressCard ? longPress : undefined}
        onFocusCard={onFocusCard ? focus : undefined}
      />
    </FocusSection>
  );
});

/** La marge du bas, au moins. */
const SCROLL_BOTTOM = 160;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  noticeAlone: { marginLeft: LEFT },
  firstAfterHead: { marginTop: 72 },
  // Seule : sa place d'ancrage, sans défiler (la marge du haut de la page).
  firstAlone: {},
  withNotes: { paddingBottom: CARD_NOTE_SPACE },
});
