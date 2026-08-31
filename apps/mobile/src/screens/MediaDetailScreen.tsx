import { useCallback } from "react";
import { View, ScrollView, RefreshControl, useWindowDimensions, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { useMediaItem, useSimilarItems, useJellyfinClient, useFavorite, useToggleWatchlist, useWatchedToggle, useSeriesWatchState } from "@tentacle-tv/api-client";
import { spacing, DETAIL_MAX_WIDTH, useResponsive, useTheme, withAlpha } from "../theme";
import { GradientOverlay, IconButton } from "../components/ui";
import { DetailSkeleton } from "../components/detail/DetailSkeleton";
import { DetailHeader } from "../components/detail/DetailHeader";
import { DetailBody } from "../components/detail/DetailBody";
import { useMediaDetailAnimations } from "../hooks/useMediaDetailAnimations";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

interface Props { itemId: string }

export function MediaDetailScreen({ itemId }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const { isTablet, isLandscape } = useResponsive();
  const twoCol = isTablet && isLandscape;
  // Bornés sur grand écran : sans cap, 52% de haut / 32% de large deviennent
  // démesurés sur iPad. Sur iPhone les min() sont sans effet (cap tablette 620
  // pour un hero plein bord plus cinématique en portrait iPad).
  const BACKDROP_H = Math.min(isTablet ? 620 : 520, Math.round(SCREEN_HEIGHT * 0.52));
  const POSTER_W = Math.min(200, Math.round(SCREEN_WIDTH * 0.32));
  const POSTER_H = Math.round(POSTER_W * 1.5);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const client = useJellyfinClient();
  const { data: item, refetch, isRefetching } = useMediaItem(itemId);
  const isEpisode = item?.Type === "Episode";
  const { data: parentSeries } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  const similarId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const similarParentId = isEpisode ? parentSeries?.ParentId : item?.ParentId;
  const { data: similar } = useSimilarItems(similarId, similarParentId);
  // Séries : prochain épisode à regarder (next-up / continue / start) — parité desktop.
  const { data: seriesWatchState } = useSeriesWatchState(item?.Type === "Series" ? item.Id : undefined);
  const actionTargetId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const actionTargetItem = isEpisode ? parentSeries : item;
  const favorite = useFavorite(actionTargetId);
  const watchlistToggle = useToggleWatchlist(actionTargetId);
  const watched = useWatchedToggle(
    actionTargetId,
    isEpisode && item?.SeriesId ? { seriesId: item.SeriesId, seasonId: item.SeasonId ?? undefined } : undefined,
  );
  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const anims = useMediaDetailAnimations(itemId, item, BACKDROP_H);

  if (!item) return <DetailSkeleton top={insets.top} />;

  const backdrop = client.getImageUrl(item.ParentBackdropItemId ?? item.Id, "Backdrop", { width: 1200, quality: 85 });
  const isSeries = item.Type === "Series";
  // Liste saisons/épisodes : série (son id) ou épisode (série parente).
  const episodeListSeriesId = isSeries ? item.Id : isEpisode ? item.SeriesId : undefined;
  const seriesResumeEp = isSeries && seriesWatchState && seriesWatchState.type !== "completed" ? seriesWatchState.episode : undefined;
  const highlightEpisodeId = isEpisode ? item.Id : seriesResumeEp?.Id;
  const highlightSeasonId = isEpisode ? item.SeasonId : seriesResumeEp?.SeasonId;
  const isWatched = item.UserData?.Played === true;

  const headerActions = { target: actionTargetItem, isWatched, favorite, watchlist: watchlistToggle, watched };
  const header = (
    <DetailHeader item={item} twoCol={twoCol} isEpisode={isEpisode} seriesWatchState={seriesWatchState}
      posterW={POSTER_W} posterH={POSTER_H} actions={headerActions} anims={anims} />
  );
  const body = (
    <Animated.View style={anims.contentStyle}>
      <DetailBody item={item} isEpisode={isEpisode} parentSeries={parentSeries} similar={similar}
        episodeListSeriesId={episodeListSeriesId} highlightEpisodeId={highlightEpisodeId} highlightSeasonId={highlightSeasonId} />
    </Animated.View>
  );
  // iPad : bouton FIXE à l'écran (il ne scrolle pas), plus grand et bordé pour
  // rester lisible sur backdrop clair. iPhone : strictement inchangé.
  // Le positionnement absolu vit sur un View englobant : IconButton applique
  // `style` à son Pressable interne (wrapper en flux → hors écran sinon).
  const backBtn = (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: Math.max(insets.top, 24) + 8, left: spacing.screenPadding, zIndex: 10 }}
    >
      <IconButton icon="←" size={isTablet ? 42 : 36} onPress={() => backOrHome(router)} accessibilityLabel={t("back")}
        bgColor={isTablet ? theme.colors.glass.tintStrong : theme.colors.glass.backdrop}
        style={isTablet ? { borderWidth: 1, borderColor: theme.colors.border.strong } : undefined} />
    </View>
  );

  // ── Paysage iPad : 2 colonnes (rail gauche figé + corps défilant), backdrop statique.
  if (twoCol) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
        <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" transition={400} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(theme.colors.surface.s0Tint, 0.86, theme.colors.overlay.scrimHeavy) }]} />
        {backBtn}
        <View style={{ flex: 1, flexDirection: "row", width: "100%", maxWidth: 1180, alignSelf: "center", paddingTop: Math.max(insets.top, 24) + 8 }}>
          <View style={{ width: 380 }}>{header}</View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxxl + 40, paddingTop: spacing.sm }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.colors.brand.violet} />}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        </View>
      </View>
    );
  }

  // ── Portrait (iPhone / iPad portrait) : colonne unique avec parallax.
  // Le backdrop vit HORS de la colonne bornée : plein bord sur iPad (« pleine
  // page », plus de bandes noires) ; seul le contenu est centré sous 920.
  // Sur iPhone (fenêtre < 920), strictement identique à avant.
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface.s0 }}>
      <AnimatedScrollView onScroll={anims.scrollHandler} scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: spacing.xxxl + 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.colors.brand.violet} />}
        showsVerticalScrollIndicator={false}>
        <View style={{ width: "100%", height: BACKDROP_H, overflow: "hidden" }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, anims.backdropStyle]}>
            <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={400} />
          </Animated.View>
          <GradientOverlay direction="top" height={120 + insets.top} intensity="soft" />
          {/* Fade bas : rampe « detail » du bureau (extinction plus progressive
              que le hero). Voile SOMBRE en clair (sinon l'affiche est délavée
              et le titre onMedia illisible) — noir PUR : le plafond 0,70 du
              clair est déjà dans la rampe (cf. GradientOverlay). */}
          <GradientOverlay direction="bottom" height={BACKDROP_H * 0.8} intensity="detail" color={theme.isDark ? undefined : `rgb(${theme.colors.onMedia.scrimRgb})`} />
        </View>
        {!isTablet && backBtn}
        <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
          {header}
          {body}
        </View>
      </AnimatedScrollView>
      {/* Après le ScrollView : peint au-dessus (l'ordre des siblings fait
          l'ordre de peinture ; le style absolu vit sur le Pressable interne
          de IconButton, pas sur son wrapper). */}
      {isTablet && backBtn}
    </View>
  );
}
