import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BACK_BUTTON_SIZE, BACK_TOP, BackButton } from "../../controls/BackButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import type { ArtworkPalette } from "../../color/artworkPalette";
import { StatusPanel } from "../shared/StatusPanel";
import { DetailBackdrop, DetailTopFade } from "./DetailBackdrop";
import { DetailHeader } from "./DetailHeader";
import { DETAIL_LEFT, SectionStage } from "./DetailSection";
import { DetailSections, type DetailSectionsProps } from "./DetailSections";
import { DetailSkeleton } from "./DetailSkeleton";
import type { DetailActionsModel, DetailHeaderModel } from "./detailTypes";
import { useSectionAnchors } from "./useSectionAnchors";

/**
 * La fiche d'un film, d'une série, d'un épisode ou d'une collection, façon
 * Apple TV : l'image de l'œuvre plein cadre sous ses voiles, sans barre de
 * navigation ni logo ; en bas à gauche du premier écran,
 * le logo, les métadonnées, les actions et le synopsis ; en descendant, les
 * sections — la page s'y ancre une à une, et l'image s'efface sur le fond
 * vivant teinté de ses couleurs.
 *
 * États : chargement (`header` nul : squelette immobile), erreur (`error` :
 * le panneau, Réessayer), fiche. Dans les trois, la croix Retour (`onBack`)
 * en haut à gauche, sur la colonne du contenu — elle défile avec la page.
 *
 * Contrat — tout arrive résolu, et les hooks existants le fourniront :
 * - `header`, `backdropUri`, `palette` : `useMediaItem` (et la série d'un
 *   épisode), `extractMediaQuality`, `paletteFromBlurHash`, la note perso par
 *   `useCardRatingTarget` ;
 * - `actions` : `useCardToggles`, `useCardRatingTarget`,
 *   `useSeriesWatchState` (« Reprendre S2 · E5 »), `useItemTrailer` ;
 * - `showTrailerHint` : `useTrailerHint().show` ;
 * - `episodes` : `useSeasonBrowser` + `useSeriesWatchState` (badges) ;
 * - `cast` / `crew` : `People` et `Studios` de l'item ;
 * - `extras` : `useItemExtras` + `useRemoteTrailers` → `buildExtraEntries` ;
 * - `saga` : `useSagaView` → `sagaTitle` / `sagaSummary` / `sagaLabel` ;
 * - `similar` : `useSimilarItems` ; `collection` : `useCollectionItems` —
 *   cartes par `resolveCardMarkers`.
 *
 * Groupe de focus (`FocusGroup`, lié par le câblage) : `detail:top` (la
 * bande de la croix, pleine largeur). Sections (`FocusSection` : HAUT / BAS
 * vers la voisine, au plus proche) : `detail:header` (le premier écran — la
 * page remonte tout en haut), `detail:seasons`, `detail:episodes`,
 * `detail:cast`, `detail:extras`, `detail:saga`, `detail:collection`,
 * `detail:similar` (la page s'ancre sur leur `DetailSection`).
 * Éléments : `detail:back` (la croix), `detail:*` (en-tête), `season:<i>`,
 * `episode:<i>`, `cast:<i>`, `extra:<i>`, `saga:<i>`, `collection:<i>`,
 * `similar:<i>`, `status:primary` (erreur).
 */

export interface DetailViewProps extends Omit<DetailSectionsProps, "onSectionLayout"> {
  /** `null` : la fiche se charge. */
  header: DetailHeaderModel | null;
  actions?: DetailActionsModel;
  /** L'image plein cadre : le fond de l'œuvre (1920 × 1080), l'image d'un épisode. */
  backdropUri?: string;
  /** La lumière de l'œuvre, pour le fond vivant sous l'image. */
  palette: ArtworkPalette;
  showTrailerHint?: boolean;
  /** Erreur : le panneau remplace la fiche. */
  error?: { title: string; message?: string } | null;
}

/** Ce que la section suivante montre d'elle au premier écran : son titre
 *  seul, au pied — jamais un bout de rangée coupé par le bord. */
const PEEK = 112;
/** La bande de la croix, en haut de la page. */
const BAR_HEIGHT = BACK_TOP + BACK_BUTTON_SIZE;
/** L'en-tête se montre la page tout en haut. */
const HEADER_REVEAL: FocusSectionReveal = { mode: "start" };

export const DetailView = memo(function DetailView({
  header,
  actions,
  backdropUri,
  palette,
  showTrailerHint,
  error,
  onPlay,
  onTrailer,
  onToggleWatchlist,
  onToggleFavorite,
  onToggleWatched,
  onRate,
  onOpenSeries,
  onRetry,
  onBack,
  ...sections
}: DetailViewProps) {
  const { t } = useTranslation();
  const scrollY = useSharedValue(0);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const scrollTo = useCallback(
    (y: number, animated: boolean) => scrollRef.current?.scrollTo({ y, animated }),
    [scrollRef],
  );
  const { onSectionLayout, tail } = useSectionAnchors(scrollTo);
  // La croix, au-dessus de la colonne du contenu ; sa bande couvre toute la
  // largeur (le câblage y pose le guide qui mène HAUT jusqu'à elle). Dans la
  // page, elle précède l'en-tête sans le chevaucher ; sur l'écran fixe
  // (chargement, erreur), elle se pose au même endroit.
  const backBar = (fixed: boolean) =>
    onBack ? (
      <FocusGroup focusKey="detail:top" style={[styles.backBar, fixed && styles.backBarFixed]}>
        <BackButton focusKey="detail:back" onPress={onBack} />
      </FocusGroup>
    ) : null;

  let body;
  if (error) {
    body = (
      <StatusPanel
        kind="error"
        title={error.title}
        message={error.message}
        primary={{ label: t("common:retry"), icon: "refresh", onPress: onRetry }}
        inset={0}
      />
    );
  } else if (!header) {
    body = <DetailSkeleton />;
  } else {
    body = (
      <>
        <DetailBackdrop uri={backdropUri} scrollY={scrollY} />
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          style={styles.fill}
          contentContainerStyle={{ paddingBottom: tail }}
        >
          {backBar(false)}
          <FocusSection focusKey="detail:header" reveal={HEADER_REVEAL} style={onBack ? styles.heroUnderBar : styles.hero}>
            <DetailHeader
              header={header}
              actions={actions}
              showTrailerHint={showTrailerHint}
              onPlay={onPlay}
              onTrailer={onTrailer}
              onToggleWatchlist={onToggleWatchlist}
              onToggleFavorite={onToggleFavorite}
              onToggleWatched={onToggleWatched}
              onRate={onRate}
              onOpenSeries={onOpenSeries}
            />
          </FocusSection>
          <SectionStage>
            <DetailSections {...sections} onSectionLayout={onSectionLayout} />
          </SectionStage>
        </Animated.ScrollView>
        <DetailTopFade scrollY={scrollY} />
      </>
    );
  }

  return (
    <View style={styles.root}>
      <AmbientBackdrop palette={palette} />
      {body}
      {header && !error ? null : backBar(true)}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  // Le premier écran : l'en-tête posé en bas à gauche de l'image, la section
  // suivante qui affleure au pied.
  hero: { minHeight: 1080 - PEEK, justifyContent: "flex-end", paddingLeft: DETAIL_LEFT, paddingTop: 140, paddingBottom: 12 },
  // Le même premier écran, sous la bande de la croix : rien ne bouge.
  heroUnderBar: {
    minHeight: 1080 - PEEK - BAR_HEIGHT,
    justifyContent: "flex-end",
    paddingLeft: DETAIL_LEFT,
    paddingTop: 140 - BAR_HEIGHT,
    paddingBottom: 12,
  },
  backBar: { height: BAR_HEIGHT, paddingTop: BACK_TOP, paddingLeft: DETAIL_LEFT, flexDirection: "row", alignItems: "flex-start" },
  backBarFixed: { position: "absolute", top: 0, left: 0, right: 0 },
});
