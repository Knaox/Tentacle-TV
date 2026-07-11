import { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, ScrollView, RefreshControl, useWindowDimensions, Pressable, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, useAnimatedScrollHandler, withSpring, withDelay, withTiming, Easing, interpolate, Extrapolation } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMediaItem, useSimilarItems, useJellyfinClient, useFavorite, useToggleWatchlist, useWatchedToggle, useSeriesWatchState } from "@tentacle-tv/api-client";
import { ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, BRAND, CTA, RADIUS, SURFACE, STATUS, DETAIL_MAX_WIDTH } from "../theme";
import { Badge, GradientOverlay, ProgressBar, IconButton } from "../components/ui";
import { MobileMediaCard } from "../components/MobileMediaCard";
import { MediaRow } from "../components/MediaRow";
import { MobileEpisodeList } from "../components/MobileEpisodeList";
import { CastRow } from "../components/CastRow";
import { LicenseAttribution } from "../components/LicenseAttribution";
import { DetailActionsRow } from "../components/detail/DetailActionsRow";
import { DetailSkeleton } from "../components/detail/DetailSkeleton";
import { MobileExtrasSection } from "../components/detail/MobileExtrasSection";
import { MetaTokens } from "../components/detail/MetaTokens";
import { buildSeriesPlayLabel, formatTime } from "../components/detail/computeBadges";
import { ENABLE_SHARED_POSTER_TRANSITION } from "../constants/featureFlags";
import { st } from "./mediaDetailStyles";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

interface Props { itemId: string }

export function MediaDetailScreen({ itemId }: Props) {
  const { t } = useTranslation("common");
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  // Bornés sur grand écran : sans cap, 52% de haut / 32% de large deviennent
  // démesurés sur iPad. Sur iPhone les min() sont sans effet (valeurs < cap).
  const BACKDROP_H = Math.min(520, Math.round(SCREEN_HEIGHT * 0.52));
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
  // Pour les séries : récupère le prochain épisode à regarder (next-up / continue / start) — parité desktop
  const { data: seriesWatchState } = useSeriesWatchState(item?.Type === "Series" ? item.Id : undefined);
  const actionTargetId = isEpisode ? (item?.SeriesId ?? itemId) : itemId;
  const actionTargetItem = isEpisode ? parentSeries : item;
  const favorite = useFavorite(actionTargetId);
  const watchlistToggle = useToggleWatchlist(actionTargetId);
  const watched = useWatchedToggle(
    actionTargetId,
    isEpisode && item?.SeriesId ? { seriesId: item.SeriesId, seasonId: item.SeasonId ?? undefined } : undefined,
  );
  const [expanded, setExpanded] = useState(false);
  const [overviewTruncated, setOverviewTruncated] = useState(false);
  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  // Parallax + one-shot Ken Burns zoom (scale 1 → 1.06 over 8s, then frozen).
  const scrollY = useSharedValue(0);
  const zoomScale = useSharedValue(1);
  const scrollHandler = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  useEffect(() => { zoomScale.value = 1; zoomScale.value = withTiming(1.06, { duration: 8000, easing: Easing.linear }); }, [zoomScale]);
  const backdropStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [0, BACKDROP_H], [0, -BACKDROP_H * 0.45], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-BACKDROP_H, 0], [1.4, 1], Extrapolation.CLAMP) * zoomScale.value },
    ],
  }));

  // Cascade entry animations
  const animatedForId = useRef<string | null>(null);
  const posterAnim = useSharedValue(0);
  const titleAnim = useSharedValue(0);
  const metaAnim = useSharedValue(0);
  const actionsAnim = useSharedValue(0);
  const contentAnim = useSharedValue(0);

  useEffect(() => {
    if (!item || animatedForId.current === itemId) return;
    animatedForId.current = itemId;
    posterAnim.value = 0; titleAnim.value = 0; metaAnim.value = 0; actionsAnim.value = 0; contentAnim.value = 0;
    posterAnim.value = withDelay(16, withSpring(1, { damping: 18, stiffness: 140, mass: 0.9 }));
    titleAnim.value = withDelay(120, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    metaAnim.value = withDelay(220, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    actionsAnim.value = withDelay(320, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    contentAnim.value = withDelay(440, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, [item, itemId, posterAnim, titleAnim, metaAnim, actionsAnim, contentAnim]);

  const posterStyle = useAnimatedStyle(() => ({
    opacity: posterAnim.value,
    transform: [{ scale: 0.85 + 0.15 * posterAnim.value }, { translateY: (1 - posterAnim.value) * 12 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleAnim.value, transform: [{ translateY: (1 - titleAnim.value) * 18 }] }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaAnim.value, transform: [{ translateY: (1 - metaAnim.value) * 14 }] }));
  const actionsStyle = useAnimatedStyle(() => ({ opacity: actionsAnim.value, transform: [{ translateY: (1 - actionsAnim.value) * 14 }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: contentAnim.value }));

  if (!item) return <DetailSkeleton top={insets.top} />;

  const backdrop = client.getImageUrl(item.ParentBackdropItemId ?? item.Id, "Backdrop", { width: 1200, quality: 85 });
  const posterId = item.Type === "Episode" ? (item.SeriesId ?? item.Id) : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { height: 500, quality: 90 });
  const isSeries = item.Type === "Series";
  // Liste saisons/épisodes : série (son id) ou épisode (série parente). Épisode
  // courant à surligner = l'épisode (fiche épisode) ou l'épisode à reprendre (série).
  const episodeListSeriesId = isSeries ? item.Id : isEpisode ? item.SeriesId : undefined;
  const seriesResumeEp = isSeries && seriesWatchState && seriesWatchState.type !== "completed" ? seriesWatchState.episode : undefined;
  const highlightEpisodeId = isEpisode ? item.Id : seriesResumeEp?.Id;
  const highlightSeasonId = isEpisode ? item.SeasonId : seriesResumeEp?.SeasonId;
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtimeMin = item.RunTimeTicks ? Math.round(ticksToSeconds(item.RunTimeTicks) / 60) : null;
  const posTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const hasResume = posTicks > 0;
  const resumeSec = ticksToSeconds(posTicks);
  const playLabel = hasResume ? t("resumeAt", { time: formatTime(resumeSec) }) : t("play");
  const progress = item.UserData?.PlayedPercentage ? item.UserData.PlayedPercentage / 100 : 0;
  const isWatched = item.UserData?.Played === true;

  return (
    <View style={{ flex: 1, backgroundColor: SURFACE.s0 }}>
      <AnimatedScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: spacing.xxxl + 40 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={BRAND.violet} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Colonne centrée bornée sur grand écran (iPad) — full width sur iPhone. */}
        <View style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, alignSelf: "center" }}>
        {/* Backdrop avec parallax */}
        <View style={{ width: "100%", height: BACKDROP_H, overflow: "hidden" }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, backdropStyle]}>
            <Image source={{ uri: backdrop }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={400} />
          </Animated.View>
          <GradientOverlay direction="top" height={120 + insets.top} color="#000000" intensity="soft" />
          <GradientOverlay direction="bottom" height={BACKDROP_H * 0.8} color="#000000" intensity="strong" />
        </View>

        <IconButton
          icon="←"
          onPress={() => router.back()}
          accessibilityLabel={t("back")}
          bgColor="rgba(0,0,0,0.55)"
          style={{ position: "absolute", top: insets.top + 8, left: spacing.screenPadding, zIndex: 10 }}
        />

        {/* Poster + Métadonnées */}
        <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -(POSTER_H * 0.55) }}>
          <Animated.View style={[{ width: POSTER_W, height: POSTER_H }, ENABLE_SHARED_POSTER_TRANSITION ? undefined : posterStyle]}>
            <Animated.Image
              source={{ uri: poster }}
              style={{
                width: POSTER_W, height: POSTER_H, borderRadius: RADIUS.lg, backgroundColor: SURFACE.s2,
                shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 20,
              }}
              resizeMode="cover"
              {...(ENABLE_SHARED_POSTER_TRANSITION ? { sharedTransitionTag: `poster-${posterId}` } : {})}
            />
            {isWatched && (
              <View style={st.watchedRing}>
                <Feather name="check" size={14} color="#000" />
              </View>
            )}
          </Animated.View>
          <Animated.View style={[{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end" }, titleStyle]}>
            {isEpisode && item.SeriesName && (
              item.SeriesId ? (
                <Pressable
                  onPress={() => router.push(`/media/${item.SeriesId}`)}
                  hitSlop={6}
                  accessibilityRole="link"
                  accessibilityLabel={item.SeriesName}
                  style={st.seriesLink}
                >
                  <Text numberOfLines={1} style={st.seriesLabel}>{item.SeriesName}</Text>
                  <Feather name="chevron-right" size={14} color={BRAND.light} />
                </Pressable>
              ) : (
                <Text numberOfLines={1} style={st.seriesLabel}>{item.SeriesName}</Text>
              )
            )}
            <Text style={st.title} numberOfLines={3}>
              {isEpisode && item.IndexNumber != null
                ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · `
                : ""}{item.Name}
            </Text>
            <Animated.View style={[st.metaRow, metaStyle]}>
              {year && <Text style={st.metaItem}>{year}</Text>}
              {runtimeMin != null && runtimeMin > 0 && <Text style={st.metaDot}>·</Text>}
              {runtimeMin != null && runtimeMin > 0 && <Text style={st.metaItem}>{t("minutesShort", { count: runtimeMin })}</Text>}
              {rating && <Text style={st.metaDot}>·</Text>}
              {rating && (
                <View style={st.ratingRow}>
                  <Feather name="star" size={11} color={STATUS.rating} />
                  <Text style={st.ratingTxt}>{rating}</Text>
                </View>
              )}
              {isSeries && item.ChildCount != null && item.ChildCount > 0 && (
                <Text style={st.metaItem}>· {t("seasonsCount", { count: item.ChildCount })}</Text>
              )}
            </Animated.View>
            <Animated.View style={metaStyle}>
              <MetaTokens item={item} />
            </Animated.View>
          </Animated.View>
        </View>

        {/* Play CTA — Films/Episodes directement, Series via useSeriesWatchState (parité desktop) */}
        {(() => {
          const seriesEp = isSeries && seriesWatchState?.type !== "completed" ? seriesWatchState?.episode : null;
          const playTargetId = seriesEp?.Id ?? (isSeries ? null : item.Id);
          if (!playTargetId) return null;
          const label = seriesEp ? buildSeriesPlayLabel(seriesEp, t) : playLabel;
          return (
            <Animated.View style={[{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.xl }, actionsStyle]}>
              {/* Bouton borné : sur iPad il ne s'étire pas sur toute la colonne. */}
              <View style={{ width: "100%", maxWidth: 420 }}>
                <Pressable
                  style={({ pressed }) => [st.playBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push(`/watch/${playTargetId}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${item.Name}`}
                >
                  <Feather name="play" size={20} color={CTA.primaryFg} fill={CTA.primaryFg} />
                  <Text style={st.playBtnTxt} numberOfLines={1}>{label}</Text>
                </Pressable>
                {!isSeries && hasResume && <ProgressBar progress={progress} style={{ marginTop: 10 }} tint={BRAND.violet} />}
              </View>
            </Animated.View>
          );
        })()}

        <Animated.View style={actionsStyle}>
          <DetailActionsRow
            target={actionTargetItem} isWatched={isWatched}
            favorite={favorite} watchlist={watchlistToggle} watched={watched}
          />
        </Animated.View>

        {/* Content — fades in last */}
        <Animated.View style={contentStyle}>
          {item.Genres && item.Genres.length > 0 && (
            <View style={st.genreRow}>
              {item.Genres.slice(0, 6).map((g) => <Badge key={g} label={g} variant="muted" uppercase={false} />)}
            </View>
          )}

          {item.Overview && (
            <View style={{ paddingHorizontal: spacing.screenPadding, marginTop: spacing.lg }}>
              <Text
                numberOfLines={expanded ? undefined : 4}
                style={st.overview}
                onTextLayout={(e) => {
                  // R4 — "Voir plus" affiché uniquement si truncation réelle détectée.
                  if (!expanded && e.nativeEvent.lines.length >= 4) setOverviewTruncated(true);
                }}
              >
                {item.Overview}
              </Text>
              {(overviewTruncated || expanded) && (
                <Pressable
                  onPress={() => setExpanded((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? t("showLess") : t("showMore")}
                >
                  <Text style={st.expandLink}>{expanded ? t("showLess") : t("showMore")}</Text>
                </Pressable>
              )}
            </View>
          )}

          {item.People && item.People.length > 0 && <CastRow people={item.People} />}

          {/* Extras (au-dessus de Saisons & Épisodes) — épisode : extras série en repli. */}
          <MobileExtrasSection item={item} seriesItem={isEpisode ? parentSeries : undefined} />

          {/* Saisons & Épisodes — séries ET épisodes (parité desktop), épisode courant surligné. */}
          {episodeListSeriesId && (
            <>
              <Text style={st.sectionTitle}>{t("seasonsEpisodes")}</Text>
              <MobileEpisodeList
                seriesId={episodeListSeriesId}
                currentEpisodeId={highlightEpisodeId}
                initialSeasonId={highlightSeasonId}
                onPlay={(ep) => router.push(`/watch/${ep.Id}`)}
              />
            </>
          )}

          <LicenseAttribution item={item} />
          {similar && similar.length > 0 && (
            <MediaRow title={t("recommendations")} data={similar}
              renderItem={(s: MediaItem) => <MobileMediaCard item={s} onPress={() => router.push(`/media/${s.Id}`)} />} />
          )}
        </Animated.View>
        </View>
      </AnimatedScrollView>
    </View>
  );
}
