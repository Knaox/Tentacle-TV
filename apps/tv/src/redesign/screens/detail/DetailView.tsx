import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { TV_STAGE } from "@tentacle-tv/theme";
import { AmbientBackdrop } from "../../background/AmbientBackdrop";
import { BrandMark } from "../../brand/BrandMark";
import { FocusGroup } from "../../focus/FocusGroup";
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
 * navigation, la marque en haut à droite ; en bas à gauche du premier écran,
 * le logo, les métadonnées, les actions et le synopsis ; en descendant, les
 * sections — la page s'y ancre une à une, et l'image s'efface sur le fond
 * vivant teinté de ses couleurs.
 *
 * États : chargement (`header` nul : squelette immobile), erreur (`error` :
 * le panneau, Réessayer / Retour), fiche.
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
 * Groupes de focus (`FocusGroup`, liés par le câblage) : `detail:header` (le
 * premier écran, pleine largeur), `detail:seasons`, `detail:episodes`,
 * `detail:cast`, `detail:extras`, `detail:saga`, `detail:collection`,
 * `detail:similar`. Éléments : `detail:*` (en-tête), `season:<i>`,
 * `episode:<i>`, `cast:<i>`, `extra:<i>`, `saga:<i>`, `collection:<i>`,
 * `similar:<i>`, `status:primary` / `status:secondary` (erreur).
 */

export interface DetailViewProps extends Omit<DetailSectionsProps, "onSectionFocus" | "onSectionLayout"> {
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
  const { onSectionFocus, onSectionLayout, tail } = useSectionAnchors(scrollTo);
  const headerFocus = useCallback((focused: boolean) => focused && onSectionFocus("header"), [onSectionFocus]);

  let body;
  if (error) {
    body = (
      <StatusPanel
        kind="error"
        title={error.title}
        message={error.message}
        primary={{ label: t("common:retry"), icon: "refresh", onPress: onRetry }}
        secondary={onBack ? { label: t("common:back"), icon: "chevronLeft", onPress: onBack } : undefined}
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
          <FocusGroup focusKey="detail:header" style={styles.hero}>
            <DetailHeader
              header={header}
              actions={actions}
              showTrailerHint={showTrailerHint}
              onFocusChange={headerFocus}
              onPlay={onPlay}
              onTrailer={onTrailer}
              onToggleWatchlist={onToggleWatchlist}
              onToggleFavorite={onToggleFavorite}
              onToggleWatched={onToggleWatched}
              onRate={onRate}
              onOpenSeries={onOpenSeries}
            />
          </FocusGroup>
          <SectionStage>
            <DetailSections {...sections} onSectionFocus={onSectionFocus} onSectionLayout={onSectionLayout} />
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
      <View style={styles.brand} pointerEvents="none">
        <BrandMark size={52} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  fill: { flex: 1 },
  // Le premier écran : l'en-tête posé en bas à gauche de l'image, la section
  // suivante qui affleure au pied.
  hero: { minHeight: 1080 - PEEK, justifyContent: "flex-end", paddingLeft: DETAIL_LEFT, paddingTop: 140, paddingBottom: 12 },
  brand: { position: "absolute", top: TV_STAGE.safe.y + 18, right: TV_STAGE.safe.x + 14 },
});
