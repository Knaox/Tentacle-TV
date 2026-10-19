import { memo, useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { OPEN_PAGE, OPEN_ROW_REVEAL, openPageBottomRoom, type OpenCardMetrics } from "@tentacle-tv/tv-core";
import { LiveAmbientBackdrop } from "../../background/AmbientBackdrop";
import type { AmbientSource } from "../../background/ambientSource";
import type { CardModel } from "../../cards/cardTypes";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { Chip } from "../../controls/Chip";
import { FocusSection } from "../../focus/FocusSection";
import { HeroBanner } from "../../hero/HeroBanner";
import type { HeroModel } from "../../hero/heroTypes";
import { NavRail, type NavRailProps } from "../../nav/NavRail";
import { OpenCardPage, useOpenCardMetrics } from "../../openRow/OpenCardPage";
import { OpenRow } from "../../openRow/OpenRow";
import { useRowRewindPort } from "../../rows/rowRewindPort";
import { RowStageProvider } from "../../rows/rowStage";
import { StatusPanel, type StatusPanelProps } from "../shared/StatusPanel";
import { useForcedFocusReveal } from "../shared/useForcedFocusReveal";
import { ForYouNotice, type ForYouNoticeModel } from "./ForYouNotice";

/**
 * « Pour vous » — la carte qui S'OUVRE (tv-core `cards/openCard.ts`) : en tête,
 * la BANNIÈRE de notre meilleure suggestion et POURQUOI (une seule cible :
 * `HeroBanner`) ; sous elle, la ligne d'état quand il y a lieu ; puis les
 * étagères dans l'ordre du moteur. Dans l'étagère focalisée, la carte s'ouvre
 * en 16:9 au bord gauche, la raison de la recommandation dans ses détails ;
 * « Découverte » sur les titres d'exploration ; les titres hors bibliothèque
 * en couleurs, leur badge dit l'absence. La première étagère porte la pastille
 * du filtre de plateformes. La bande-annonce se joue DERRIÈRE la carte ouverte
 * ou la bannière (`OpenCardPage`).
 *
 * Contrat — tout arrive résolu (`ForYouRedesign`) : `hero`, `shelves`,
 * `notice`, `filter`, `status`, `palette`, `ambient`. Sections : `section:hero`,
 * `section:<étagère>` ; chaque étagère se pose toujours au même endroit
 * (`OPEN_ROW_REVEAL`) et revient au début une fois sortie de l'écran.
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
  ambient?: AmbientSource;
  status?: StatusPanelProps | null;
  /** OK sur la bannière : la fiche (ou la demande, hors bibliothèque). */
  onHeroPrimary?: () => void;
  /** OK maintenu sur la bannière : le grand panneau d'une recommandation. */
  onHeroLongPress?: () => void;
  /** Ce que fait OK sur la bannière ; défaut : la fiche. */
  heroOkHint?: string;
  onRemoveFilter?: () => void;
  onPressCard?: (shelfKey: string, card: CardModel) => void;
  onLongPressCard?: (shelfKey: string, card: CardModel) => void;
  onFocusCard?: (shelfKey: string, card: CardModel) => void;
}

const LEFT = TV_STAGE.contentLeft;
const NOTICE_WIDTH = 1920 - LEFT - 56;

export const ForYouView = memo(function ForYouView({
  nav, hero, notice, shelves, filter, palette, ambient, status, onHeroPrimary, onHeroLongPress, heroOkHint,
  onRemoveFilter, onPressCard, onLongPressCard, onFocusCard,
}: ForYouViewProps) {
  const { scrollRef, sectionLayout, onViewportLayout } = useForcedFocusReveal();
  const rewind = useRowRewindPort();
  const metrics = useOpenCardMetrics();
  const scrollContent = useMemo(() => ({ paddingTop: hero ? 0 : OPEN_PAGE.heroTop, paddingBottom: openPageBottomRoom(metrics) }), [hero, metrics]);
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
          <OpenCardPage hero={hero}>
            <ScrollView
              ref={scrollRef}
              style={styles.fill}
              contentContainerStyle={scrollContent}
              showsVerticalScrollIndicator={false}
              onLayout={onViewportLayout}
              onScroll={onScroll}
              scrollEventThrottle={32}
            >
              {hero ? <HeroBanner hero={hero} okHint={heroOkHint} onPress={onHeroPrimary} onLongPress={onHeroLongPress} /> : null}
              {notice ? (
                <View style={styles.notice}>
                  <ForYouNotice notice={notice} width={NOTICE_WIDTH} />
                </View>
              ) : null}
              {shelves.map((shelf, index) => (
                <Shelf
                  key={shelf.key}
                  shelf={shelf}
                  rank={index}
                  metrics={metrics}
                  filterLabel={index === 0 && filter ? filter.label : undefined}
                  onRemoveFilter={onRemoveFilter}
                  onLayout={sectionLayout(shelf.key, index === 0 ? [shelf.key, "filter"] : [shelf.key])}
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
    </View>
  );
});

type ShelfHandler = (shelfKey: string, card: CardModel) => void;

/** Une étagère, mémoïsée sur son modèle : la lumière du fond qui change ne la redessine pas. */
const Shelf = memo(function Shelf({ shelf, rank, metrics, filterLabel, onRemoveFilter, onLayout, onPressCard, onLongPressCard, onFocusCard }: {
  shelf: ForYouShelfModel;
  rank: number;
  metrics: OpenCardMetrics;
  filterLabel?: string;
  onRemoveFilter?: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onPressCard?: ShelfHandler;
  onLongPressCard?: ShelfHandler;
  onFocusCard?: ShelfHandler;
}) {
  const key = shelf.key;
  const rewind = useRowRewindPort();
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout(event);
      const { y, height } = event.nativeEvent.layout;
      rewind?.layout(key, y, height);
    },
    [onLayout, rewind, key],
  );
  const press = useCallback((card: CardModel) => onPressCard?.(key, card), [onPressCard, key]);
  const longPress = useCallback((card: CardModel) => onLongPressCard?.(key, card), [onLongPressCard, key]);
  const focus = useCallback((card: CardModel) => onFocusCard?.(key, card), [onFocusCard, key]);
  return (
    <FocusSection focusKey={`section:${key}`} reveal={OPEN_ROW_REVEAL} rowRevealStart onLayout={layout}>
      <OpenRow
        rowKey={key}
        title={shelf.title}
        cards={shelf.cards}
        metrics={metrics}
        inset={LEFT}
        stageRank={rank}
        accessory={filterLabel ? <Chip label={filterLabel} trailingIcon="close" size="md" selected focusKey="filter:remove" onPress={onRemoveFilter} /> : undefined}
        onPressCard={onPressCard ? press : undefined}
        onLongPressCard={onLongPressCard ? longPress : undefined}
        onFocusCard={onFocusCard ? focus : undefined}
      />
    </FocusSection>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  notice: { marginLeft: LEFT, marginBottom: 40 },
});
