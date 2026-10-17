import { memo, useCallback, useMemo, useRef, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { BELOW_ZONE_ANCHOR_TOP, BELOW_ZONE_REVEAL, HOME_LOADING_KEY, heroInView } from "@tentacle-tv/tv-core";
import { useTranslation } from "react-i18next";
import { LiveAmbientBackdrop } from "../../background/AmbientBackdrop";
import type { AmbientSource } from "../../background/ambientSource";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { FocusTarget } from "../../focus/FocusTarget";
import { HeroBanner, type HeroModel } from "../../hero/HeroBanner";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { BelowZonePage, useBelowZoneBottomRoom } from "../../rows/BelowZonePage";
import { MEDIA_ROW_TRAILING, MediaRow } from "../../rows/MediaRow";
import { useRowRewindPort } from "../../rows/rowRewindPort";
import { RowStageProvider } from "../../rows/rowStage";
import { ScreenReveal } from "../../motion/ScreenReveal";
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
 * `useNextUp`, `useWatchlist`, `useLatestItems`, `useRecoPageVisit` (cartes),
 * `useCardMarkers` (marqueurs) et `paletteFromBlurHash` (lumière).
 *
 * La page est À ZONE (`BelowZonePage`, tv-core `previewZoneLayout.ts`) : en
 * haut, la zone fixe de l'aperçu (`zone`), dessous, la page qui défile — le
 * héros en tête, puis les rangées. Le héros et chaque rangée sont des
 * SECTIONS (`FocusSection`) : HAUT / BAS passe de l'une à la voisine, au plus
 * proche ; dans le héros, la page remonte tout en haut ; la rangée focalisée
 * se pose TOUJOURS au même endroit, juste sous la zone, en un seul mouvement
 * — seule la page bouge.
 * Au banc, la rangée de la clé figée (`useForcedFocusReveal`).
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
  /** La lumière du fond quand aucune carte n'impose la sienne : celle du héros. */
  palette: ArtworkPalette;
  /** La lumière de la carte focalisée, que le fond suit seul (`ambientSource`). */
  ambient?: AmbientSource;
  /** Chargement, erreur, accueil vide : le panneau remplace le contenu. */
  status?: StatusPanelProps | null;
  /** Le chargement : une ancre invisible tient le focus (`home:loading`) ; la navigation et le contenu
   *  ne paraissent qu'ensuite, ensemble, en fondu (`ScreenReveal`). */
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
  /** La zone fixe de l'aperçu, en haut (`BelowZonePage`). */
  zone?: ReactNode;
}

const LEFT = TV_STAGE.contentLeft;
const HERO_WIDTH = 1920 - LEFT - 56;
/** Le héros se montre la page tout en haut ; une rangée se pose toujours au même endroit, sous la
 *  zone (tv-core `previewZoneLayout.ts`). */
const HERO_REVEAL: FocusSectionReveal = { mode: "start" };
const ROW_REVEAL: FocusSectionReveal = BELOW_ZONE_REVEAL;

export const HomeView = memo(function HomeView({
  nav,
  hero,
  rows,
  palette,
  ambient,
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
  zone,
}: HomeViewProps) {
  const { t } = useTranslation();
  const loadingLabel = t("common:loading");
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  const heroVisible = useRef(true);
  const rewind = useRowRewindPort();
  // La dernière rangée se pose sous la zone comme les autres : la marge du bas qu'il lui faut.
  const bottom = useBelowZoneBottomRoom(SCROLL_BOTTOM);
  const scrollContent = useMemo(() => ({ paddingTop: BELOW_ZONE_ANCHOR_TOP, paddingBottom: bottom.room }), [bottom.room]);
  const heroSection = hero ? (
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
  ) : null;
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      rewind?.scroll(contentOffset.y, layoutMeasurement.height);
      // Plus de la moitié du héros hors de l'écran : il n'est plus dans le champ (tv-core).
      const visible = heroInView(contentOffset.y, 0, TV_STAGE.hero.height);
      if (visible === heroVisible.current) return;
      heroVisible.current = visible;
      onHeroVisibleChange?.(visible);
    },
    [onHeroVisibleChange, rewind],
  );
  return (
    <View style={styles.root}>
      <LiveAmbientBackdrop source={ambient} palette={palette} />
      {/* Le premier chargement se dit seul, sans navigation : elle paraît avec le contenu. */}
      {holdFocus && status ? <StatusPanel {...status} /> : null}
      <ScreenReveal ready={!holdFocus}>
        {holdFocus ? null : status ? (
          <StatusPanel {...status} />
        ) : (
          <RowStageProvider>
            <BelowZonePage zone={zone}>
              <ScrollView
                ref={scrollRef}
                style={styles.fill}
                contentContainerStyle={scrollContent}
                showsVerticalScrollIndicator={false}
                onLayout={onViewportLayout}
                onScroll={handleScroll}
                scrollEventThrottle={32}
              >
                {heroSection}
                {rows.map((row, index) => (
                  <HomeRow
                    key={row.key}
                    row={row}
                    rank={index}
                    afterHero={index === 0 && hero !== null}
                    filterLabel={filter && row.key === filterRowKey ? filter.label : undefined}
                    onLayout={sectionLayout(row.key, row.key === filterRowKey ? [row.key, "filter"] : [row.key])}
                    onMeasureLast={index === rows.length - 1 ? bottom.onLastLayout : undefined}
                    onRemoveFilter={onRemoveFilter}
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
      </ScreenReveal>
      {/* Après le contenu (rien ne la recouvre : tvOS ne focalise jamais ce qui l'est), hors du panneau centré. */}
      {holdFocus ? (
        <FocusTarget focusKey={HOME_LOADING_KEY} style={styles.anchor} accessibilityLabel={loadingLabel}>
          {() => null}
        </FocusTarget>
      ) : null}
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
  afterHero,
  filterLabel,
  onLayout,
  onMeasureLast,
  onRemoveFilter,
  onPressCard,
  onLongPressCard,
  onFocusCard,
}: {
  row: HomeRowModel;
  /** Sa place dans la page : son tour dans le montage échelonné (`rowStage`). */
  rank: number;
  /** La première rangée, sous le héros : son écart à lui. */
  afterHero?: boolean;
  filterLabel?: string;
  onLayout: (event: LayoutChangeEvent) => void;
  /** La dernière rangée : sa hauteur fait la marge du bas de la page (`useBelowZoneBottomRoom`). */
  onMeasureLast?: (event: LayoutChangeEvent) => void;
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
      onMeasureLast?.(event);
      const { y, height } = event.nativeEvent.layout;
      rewind?.layout(key, y, height - MEDIA_ROW_TRAILING);
    },
    [onLayout, onMeasureLast, rewind, key],
  );
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <FocusSection
      focusKey={`section:${key}`}
      reveal={ROW_REVEAL}
      rowReveal
      onLayout={layout}
      style={afterHero ? styles.firstAfterHero : undefined}
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

/** La marge du bas, au moins. */
const SCROLL_BOTTOM = 160;

const styles = StyleSheet.create({
  // L'ancre du chargement : invisible, dans le contenu (en haut à gauche, hors du panneau centré).
  anchor: { position: "absolute", left: TV_STAGE.contentLeft, top: TV_STAGE.hero.top, width: 24, height: 24 },
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  // Le héros en tête de la fenêtre sous la zone : sans la marge d'avant, il y tient entier.
  hero: { marginLeft: LEFT, marginTop: -BELOW_ZONE_ANCHOR_TOP },
  firstAfterHero: { marginTop: 56 },
});
