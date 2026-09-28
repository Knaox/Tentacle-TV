import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, RefreshControl, Pressable, useWindowDimensions, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { backOrHome } from "@/utils/backOrHome";
import { useTranslation } from "react-i18next";
import { detailGallery, galleryIndexOf } from "@tentacle-tv/shared";
import { useMediaItem, useSimilarItems, useJellyfinClient, useFavorite, useToggleWatchlist, useWatchedToggle, useSeriesWatchState } from "@tentacle-tv/api-client";
import { spacing, DETAIL_MAX_WIDTH, useResponsive, useTheme, withAlpha } from "../theme";
import { GradientOverlay, IconButton } from "../components/ui";
import { DetailSkeleton } from "../components/detail/DetailSkeleton";
import { DetailHeader } from "../components/detail/DetailHeader";
import { DetailTopBar } from "../components/detail/DetailTopBar";
import { DetailBody } from "../components/detail/DetailBody";
import { DetailStageBlock } from "../components/detail/DetailStageBlock";
import { DetailImageViewer } from "../components/detail/DetailImageViewer";
import { StageFocus } from "../components/detail/StageFocus";
import { useMediaDetailAnimations } from "../hooks/useMediaDetailAnimations";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

interface Props { itemId: string }

export function MediaDetailScreen({ itemId }: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const { isTablet, isLandscape } = useResponsive();
  const twoCol = isTablet && isLandscape;
  // La SCÈNE : le décor sur 70 % de l'écran (plafond 680), 64 % sur tablette
  // (plafond 860) ; le bloc titre se pose dans son bas.
  const BACKDROP_H = isTablet ? Math.min(860, Math.round(SCREEN_HEIGHT * 0.64)) : Math.min(680, Math.round(SCREEN_HEIGHT * 0.7));
  const LOGO_MAX_W = Math.min(isTablet ? 460 : 300, Math.round(SCREEN_WIDTH * 0.76));
  const LOGO_MAX_H = isTablet ? 140 : 96;
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
  // Favoris et Ma liste visent la SÉRIE pour un épisode — c'est la règle du
  // produit. « Vu » non : il ne marque que ce qu'on a désigné. Le confondre
  // envoyait `/PlayedItems/{seriesId}`, et Jellyfin marquait toute la série.
  const actionTargetId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const actionTargetItem = isEpisode ? parentSeries : item;
  const favorite = useFavorite(actionTargetId);
  const watchlistToggle = useToggleWatchlist(actionTargetId);
  const watched = useWatchedToggle(itemId, {
    seriesId: item?.SeriesId,
    seasonId: item?.SeasonId ?? undefined,
    itemType: item?.Type,
  });
  const onRefresh = useCallback(() => { refetch(); }, [refetch]);
  // Vue « image plein écran » : index de l'image ouverte, `null` = fermée.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const gallery = useMemo(() => (item ? detailGallery(item) : []), [item]);
  const closeViewer = useCallback(() => setViewerIndex(null), []);

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

  const openImages = gallery.length > 0 ? () => setViewerIndex(0) : undefined;
  const openPoster = gallery.length > 0 ? () => setViewerIndex(galleryIndexOf(gallery, isEpisode ? "still" : "poster")) : undefined;
  const viewer = <DetailImageViewer title={item.Name} gallery={gallery} index={viewerIndex} onClose={closeViewer} />;
  const headerActions = { target: actionTargetItem, item, isWatched, favorite, watchlist: watchlistToggle, watched };
  const header = (
    <DetailHeader item={item} twoCol={twoCol} isEpisode={isEpisode} seriesWatchState={seriesWatchState}
      posterW={POSTER_W} posterH={POSTER_H} actions={headerActions} anims={anims} onOpenPoster={openPoster} />
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
          {/* La colonne démarre sous le retour fixe (l'affiche passait dessous). */}
          <ScrollView style={{ width: 380, flexGrow: 0 }} contentContainerStyle={{ paddingTop: 52, paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
            {header}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxxl + 40, paddingTop: spacing.sm }}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.colors.brand.violet} />}
            showsVerticalScrollIndicator={false}>
            {body}
          </ScrollView>
        </View>
        {viewer}
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
        {/* La SCÈNE : le bloc titre est posé DANS le décor, il ne le quitte
            jamais — c'est ce qui garde son texte blanc lisible dans les deux
            thèmes. Toucher le décor ouvre la vue plein écran des images. */}
        <View style={{ width: "100%", minHeight: BACKDROP_H, justifyContent: "flex-end", overflow: "hidden" }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={openImages} disabled={!openImages}
            accessibilityRole="imagebutton" accessibilityLabel={t("media:detailViewImages")}>
            <Animated.View style={[StyleSheet.absoluteFillObject, anims.backdropStyle]}>
              <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%" }} contentFit="cover" contentPosition={{ top: "30%", left: "50%" }} transition={400} />
            </Animated.View>
          </Pressable>
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <GradientOverlay direction="top" height={120 + insets.top} intensity="soft" />
            {/* Fondu bas : rampe « detail » ; voile SOMBRE en clair (noir pur,
                le plafond 0,70 du clair est déjà dans la rampe). */}
            <GradientOverlay direction="bottom" height={BACKDROP_H * 0.8} intensity="detail" color={theme.isDark ? undefined : `rgb(${theme.colors.onMedia.scrimRgb})`} />
            <StageFocus />
          </View>
          <View pointerEvents="box-none" style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center", paddingHorizontal: spacing.screenPadding, paddingTop: Math.max(insets.top, 24) + 64, paddingBottom: spacing.sm }}>
            <DetailStageBlock item={item} align="center" tone="media" logoMaxW={LOGO_MAX_W} logoMaxH={LOGO_MAX_H}
              titleStyle={anims.titleStyle} metaStyle={anims.metaStyle} />
          </View>
        </View>
        <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
          {header}
          {body}
        </View>
      </AnimatedScrollView>
      {/* Après le ScrollView : peint au-dessus (l'ordre des siblings fait
          l'ordre de peinture). La barre protège la zone d'état dès le premier
          pixel — sans elle, l'heure et la batterie se posaient sur l'affiche. */}
      <DetailTopBar
        title={item?.Name ?? ""}
        scrollY={anims.scrollY}
        revealAt={BACKDROP_H * 0.82}
        onBack={() => backOrHome(router)}
        onOpenImages={openImages}
      />
      {viewer}
    </View>
  );
}
