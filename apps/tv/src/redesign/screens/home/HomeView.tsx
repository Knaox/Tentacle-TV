import { memo, useCallback, useRef } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { HOME_LOADING_KEY, heroInView } from "@tentacle-tv/tv-core";
import { useTranslation } from "react-i18next";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { FocusTarget } from "../../focus/FocusTarget";
import { HeroBanner, type HeroModel } from "../../hero/HeroBanner";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { MEDIA_ROW_TRAILING, MediaRow } from "../../rows/MediaRow";
import { useRowRewindPort } from "../../rows/rowRewindPort";
import { RowStageProvider } from "../../rows/rowStage";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";

/**
 * L'accueil : la carte héros plein format, puis les rangées dans l'ordre de
 * la mise en page du compte. La navigation flotte à gauche, et le fond prend
 * la lumière de ce qui a le focus. Aucun logo : la marque vit dans l'icône,
 * le Top Shelf, le démarrage et les illustrations (choix du 2026-10-02).
 *
 * Contrat : tout arrive résolu. Alimenté plus tard par `useTVHomeRows`
 * (ordre des rangées), `useResumeItems` / `useFeaturedItems` (héros),
 * `useNextUp`, `useWatchlist`, `useLatestItems`, `useRecoPage` (cartes),
 * `useCardMarkers` (marqueurs) et `paletteFromBlurHash` (lumière).
 *
 * Le héros et chaque rangée sont des SECTIONS (`FocusSection`) : HAUT / BAS
 * passe de l'une à la voisine, au plus proche ; le focus qui entre dans une
 * rangée l'amène ENTIÈRE à l'écran — sa légende et l'indication de l'appui
 * long avec elle —, en un seul mouvement ; dans le héros, la page remonte tout
 * en haut. Au banc, la rangée de la clé figée (`useForcedFocusReveal`).
 *
 * `filter` : la pastille du filtre de plateformes du compte, posée sur la
 * rangée `filterRowKey` — la première rangée recommandée réellement servie
 * (`useRecoFilterChipRow`). Un appui la retire (`onRemoveFilter`).
 *
 * `onHeroVisibleChange` dit quand le héros quitte l'écran — plus de la
 * moitié défilée — et quand il y revient : sa rotation s'y suspend.
 *
 * Les rangées reviennent au début une fois sorties de l'écran : la page dit
 * au port des rangées (`rowRewindPort`) où elles sont et qu'elle défile.
 *
 * Clés de focus : `hero:primary`, `hero:secondary`, `hero:list`,
 * `<rangée>:<index>` pour les cartes, `filter:remove`, `status:primary`,
 * `status:secondary`, et `nav:<entrée>` pour la navigation. Sections :
 * `section:hero`, `section:<rangée>`.
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
  /** Le chargement : une ancre invisible tient le focus dans le contenu (`home:loading`), la navigation reste repliée. */
  holdFocus?: boolean;
  /** La pastille du filtre de plateformes (« Netflix · Disney+ »). */
  filter?: { label: string } | null;
  /** La rangée qui la porte. */
  filterRowKey?: string | null;
  onRemoveFilter?: () => void;
  onHeroPrimary?: () => void;
  onHeroSecondary?: () => void;
  /** Le rond « Ma liste » du héros. */
  onHeroToggleList?: () => void;
  /** L'appui maintenu sur un bouton du héros : le grand panneau du titre. */
  onHeroLongPress?: () => void;
  onPressCard?: (rowKey: string, card: CardModel) => void;
  onLongPressCard?: (rowKey: string, card: CardModel) => void;
  onFocusCard?: (rowKey: string, card: CardModel) => void;
  /** Le héros quitte l'écran (plus de la moitié défilée) ou y revient. */
  onHeroVisibleChange?: (visible: boolean) => void;
}

const LEFT = TV_STAGE.contentLeft;
const HERO_WIDTH = 1920 - LEFT - 56;
/** Le héros se montre la page tout en haut ; une rangée, entière, au plus près. */
const HERO_REVEAL: FocusSectionReveal = { mode: "start" };
const ROW_REVEAL: FocusSectionReveal = { mode: "nearest" };

export const HomeView = memo(function HomeView({
  nav,
  hero,
  rows,
  palette,
  status,
  holdFocus = false,
  filter,
  filterRowKey,
  onRemoveFilter,
  onHeroPrimary,
  onHeroSecondary,
  onHeroToggleList,
  onHeroLongPress,
  onPressCard,
  onLongPressCard,
  onFocusCard,
  onHeroVisibleChange,
}: HomeViewProps) {
  const { t } = useTranslation();
  const loadingLabel = t("common:loading");
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  const heroVisible = useRef(true);
  const rewind = useRowRewindPort();
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      rewind?.scroll(contentOffset.y, layoutMeasurement.height);
      // Plus de la moitié du héros hors de l'écran : il n'est plus dans le champ (tv-core).
      const visible = heroInView(contentOffset.y, TV_STAGE.hero.top, TV_STAGE.hero.height);
      if (visible === heroVisible.current) return;
      heroVisible.current = visible;
      onHeroVisibleChange?.(visible);
    },
    [onHeroVisibleChange, rewind],
  );
  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {status ? (
        <StatusPanel {...status} />
      ) : (
        <RowStageProvider>
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
              <FocusSection focusKey="section:hero" reveal={HERO_REVEAL} style={styles.hero} onLayout={sectionLayout("hero", ["hero"])}>
                <HeroBanner
                  hero={hero}
                  width={HERO_WIDTH}
                  onPrimary={onHeroPrimary}
                  onSecondary={onHeroSecondary}
                  onToggleList={onHeroToggleList}
                  onLongPress={onHeroLongPress}
                />
              </FocusSection>
            ) : null}
            {rows.map((row, index) => (
              <HomeRow
                key={row.key}
                row={row}
                rank={index}
                first={index === 0 ? (hero ? "afterHero" : "alone") : undefined}
                filterLabel={filter && row.key === filterRowKey ? filter.label : undefined}
                onLayout={sectionLayout(row.key, row.key === filterRowKey ? [row.key, "filter"] : [row.key])}
                onRemoveFilter={onRemoveFilter}
                onPressCard={onPressCard}
                onLongPressCard={onLongPressCard}
                onFocusCard={onFocusCard}
              />
            ))}
          </ScrollView>
        </RowStageProvider>
      )}
      {/* Après le contenu (rien ne la recouvre : tvOS ne focalise jamais ce qui l'est), hors du panneau centré. */}
      {holdFocus ? (
        <FocusTarget focusKey={HOME_LOADING_KEY} style={styles.anchor} accessibilityLabel={loadingLabel}>
          {() => null}
        </FocusTarget>
      ) : null}
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
  rank,
  first,
  filterLabel,
  onLayout,
  onRemoveFilter,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: {
  row: HomeRowModel;
  /** Sa place dans la page : son tour dans le montage échelonné (`rowStage`). */
  rank: number;
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
  const rewind = useRowRewindPort();
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout(event);
      const { y, height } = event.nativeEvent.layout;
      rewind?.layout(key, y, height - MEDIA_ROW_TRAILING);
    },
    [onLayout, rewind, key],
  );
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <FocusSection
      focusKey={`section:${key}`}
      reveal={ROW_REVEAL}
      onLayout={layout}
      style={first === "afterHero" ? styles.firstAfterHero : first === "alone" ? styles.firstAlone : undefined}
    >
      <MediaRow
        rowKey={key}
        title={row.title}
        cards={row.cards}
        variant={row.variant}
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

const styles = StyleSheet.create({
  // L'ancre du chargement : invisible, dans le contenu (en haut à gauche, hors du panneau centré).
  anchor: { position: "absolute", left: TV_STAGE.contentLeft, top: TV_STAGE.hero.top, width: 24, height: 24 },
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  scroll: { paddingBottom: 160 },
  hero: { marginLeft: LEFT, marginTop: TV_STAGE.hero.top },
  firstAfterHero: { marginTop: 56 },
  firstAlone: { marginTop: TV_STAGE.safe.y + 40 },
});
