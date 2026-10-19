import { memo, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { HOME_LOADING_KEY, OPEN_PAGE, heroInView, openPageBottomRoom, type OpenCardMetrics } from "@tentacle-tv/tv-core";
import { LiveAmbientBackdrop } from "../../background/AmbientBackdrop";
import type { AmbientSource } from "../../background/ambientSource";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { FocusTarget } from "../../focus/FocusTarget";
import { HeroBanner } from "../../hero/HeroBanner";
import type { HeroModel } from "../../hero/heroTypes";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { OpenCardPage, useOpenCardMetrics } from "../../openRow/OpenCardPage";
import { OpenRowSection } from "../../openRow/OpenRowSection";
import { useRowRewindPort } from "../../rows/rowRewindPort";
import { RowStageProvider } from "../../rows/rowStage";
import { ScreenReveal } from "../../motion/ScreenReveal";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";

/**
 * L'accueil (Apple TV, Android TV) — la carte qui S'OUVRE (banc validé par
 * Damien le 19/10, tv-core `cards/openCard.ts`) : la BANNIÈRE d'abord, une
 * seule cible (`HeroBanner`), puis les rangées dans l'ordre de la mise en page
 * du compte. Dans la rangée focalisée, la carte s'ouvre en 16:9 au bord
 * gauche, ses détails dessous ; la rangée se pose TOUJOURS au même endroit
 * (`OPEN_ROW_REVEAL`), seule la page bouge. La bande-annonce se joue DERRIÈRE
 * la carte ouverte ou la bannière (`OpenCardPage`, sa scène) : rien ne
 * recouvre une cible. La navigation flotte à gauche ; le fond prend la lumière
 * de ce qui a le focus. Aucun logo (choix du 2026-10-02).
 *
 * `filter` : la pastille du filtre de plateformes du compte, posée sur la
 * rangée `filterRowKey` (`useRecoFilterChipRow`). Un appui la retire.
 *
 * Les rangées reviennent au début une fois sorties de l'écran : la page dit
 * au port des rangées (`rowRewindPort`) où elles sont et qu'elle défile.
 *
 * Clés de focus : `hero:primary` (la bannière), `<rangée>:<index>` pour les
 * cartes, `filter:remove`, `status:primary`, `status:secondary`, et
 * `nav:<entrée>`. Sections : `section:hero`, `section:<rangée>`.
 */

export interface HomeRowModel {
  key: string;
  title: string;
  variant: "landscape" | "poster";
  cards: CardModel[];
}

export interface HomeViewProps {
  nav: NavRailProps;
  hero: HeroModel | null;
  rows: HomeRowModel[];
  palette: ArtworkPalette;
  ambient?: AmbientSource;
  status?: StatusPanelProps | null;
  holdFocus?: boolean;
  filter?: { label: string } | null;
  filterRowKey?: string | null;
  onRemoveFilter?: () => void;
  /** OK sur la bannière : la fiche du titre, ou sa demande hors bibliothèque. */
  onHeroPrimary?: () => void;
  /** OK maintenu sur la bannière : le grand panneau du titre. */
  onHeroLongPress?: () => void;
  /** Ce que fait OK sur la bannière (« OK : ouvrir la fiche ») ; défaut : la fiche. */
  heroOkHint?: string;
  onPressCard?: (rowKey: string, card: CardModel) => void;
  onLongPressCard?: (rowKey: string, card: CardModel) => void;
  onFocusCard?: (rowKey: string, card: CardModel) => void;
  /** La bannière quitte l'écran (plus de la moitié défilée) ou y revient. */
  onHeroVisibleChange?: (visible: boolean) => void;
}


export const HomeView = memo(function HomeView({
  nav, hero, rows, palette, ambient, status, holdFocus = false, filter, filterRowKey, onRemoveFilter,
  onHeroPrimary, onHeroLongPress, heroOkHint, onPressCard, onLongPressCard, onFocusCard, onHeroVisibleChange,
}: HomeViewProps) {
  const { t } = useTranslation();
  const loadingLabel = t("common:loading");
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  const rewind = useRowRewindPort();
  const metrics = useOpenCardMetrics();
  const scrollContent = useMemo(() => ({ paddingTop: hero ? 0 : OPEN_PAGE.heroTop, paddingBottom: openPageBottomRoom(metrics) }), [hero, metrics]);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      rewind?.scroll(contentOffset.y, layoutMeasurement.height);
      onHeroVisibleChange?.(heroInView(contentOffset.y, OPEN_PAGE.heroTop, OPEN_PAGE.heroHeight));
    },
    [rewind, onHeroVisibleChange],
  );
  return (
    <View style={styles.root}>
      <LiveAmbientBackdrop source={ambient} palette={palette} />
      {holdFocus && status ? <StatusPanel {...status} /> : null}
      <ScreenReveal ready={!holdFocus}>
        {holdFocus ? null : status ? (
          <StatusPanel {...status} />
        ) : (
          <RowStageProvider>
            <OpenCardPage hero={hero}>
              <ScrollView
                ref={scrollRef}
                style={styles.fill}
                contentContainerStyle={scrollContent}
                showsVerticalScrollIndicator={false}
                onLayout={onViewportLayout}
                onScroll={handleScroll}
                scrollEventThrottle={32}
              >
                {hero ? <HeroBanner hero={hero} okHint={heroOkHint} onPress={onHeroPrimary} onLongPress={onHeroLongPress} /> : null}
                {rows.map((row, index) => (
                  <HomeRow
                    key={row.key}
                    row={row}
                    rank={index}
                    metrics={metrics}
                    filterLabel={filter && row.key === filterRowKey ? filter.label : undefined}
                    onLayout={sectionLayout(row.key, row.key === filterRowKey ? [row.key, "filter"] : [row.key])}
                    onRemoveFilter={onRemoveFilter}
                    onPressCard={onPressCard}
                    onLongPressCard={onLongPressCard}
                    onFocusCard={onFocusCard}
                  />
                ))}
              </ScrollView>
            </OpenCardPage>
          </RowStageProvider>
        )}
        <NavRail {...nav} />
      </ScreenReveal>
      {holdFocus ? (
        <FocusTarget focusKey={HOME_LOADING_KEY} style={styles.anchor} accessibilityLabel={loadingLabel}>
          {() => null}
        </FocusTarget>
      ) : null}
    </View>
  );
});

type RowHandler = (rowKey: string, card: CardModel) => void;

/** Une rangée, mémoïsée sur son modèle : la lumière du fond qui change ne la redessine pas. */
const HomeRow = memo(function HomeRow({ row, rank, metrics, filterLabel, onLayout, onRemoveFilter, onPressCard, onLongPressCard, onFocusCard }: {
  row: HomeRowModel;
  rank: number;
  metrics: OpenCardMetrics;
  filterLabel?: string;
  onLayout: (event: LayoutChangeEvent) => void;
  onRemoveFilter?: () => void;
  onPressCard?: RowHandler;
  onLongPressCard?: RowHandler;
  onFocusCard?: RowHandler;
}) {
  const { t } = useTranslation("cards");
  const key = row.key;
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <OpenRowSection
      rowKey={key}
      title={row.title}
      cards={row.cards}
      metrics={metrics}
      rank={rank}
      // Les rangées d'épisodes (Reprendre, Prochains épisodes) : OK lit (tv-core `cardPress`).
      okHint={row.variant === "landscape" ? t("okPlay") : undefined}
      accessory={filterLabel ? <Chip label={filterLabel} trailingIcon="close" size="md" selected focusKey="filter:remove" onPress={onRemoveFilter} /> : undefined}
      onLayout={onLayout}
      onPressCard={onPressCard ? press : undefined}
      onLongPressCard={onLongPressCard ? longPress : undefined}
      onFocusCard={onFocusCard ? focus : undefined}
    />
  );
});

const styles = StyleSheet.create({
  anchor: { position: "absolute", left: TV_STAGE.contentLeft, top: TV_STAGE.hero.top, width: 24, height: 24 },
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
});
