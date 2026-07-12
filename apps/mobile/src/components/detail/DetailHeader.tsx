import { type ComponentProps } from "react";
import { View, Text, Pressable } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { ticksToSeconds } from "@tentacle-tv/shared";
import type { MediaItem } from "@tentacle-tv/shared";
import { spacing, BRAND, CTA, RADIUS, SURFACE, STATUS } from "../../theme";
import { ProgressBar } from "../ui";
import { DetailActionsRow } from "./DetailActionsRow";
import { MetaTokens } from "./MetaTokens";
import { buildSeriesPlayLabel, formatTime } from "./computeBadges";
import { ENABLE_SHARED_POSTER_TRANSITION } from "../../constants/featureFlags";
import { st } from "../../screens/mediaDetailStyles";
import type { useMediaDetailAnimations } from "../../hooks/useMediaDetailAnimations";

type SeriesWatchState = { type: string; episode?: MediaItem } | undefined;

interface Props {
  item: MediaItem;
  /** Paysage iPad : hero empilé en rail gauche ; sinon rangée poster+méta. */
  twoCol: boolean;
  isEpisode: boolean;
  seriesWatchState: SeriesWatchState;
  posterW: number;
  posterH: number;
  actions: ComponentProps<typeof DetailActionsRow>;
  anims: ReturnType<typeof useMediaDetailAnimations>;
}

/**
 * Bloc « hero » de la fiche détail : poster + titre/méta + CTA Lecture + actions.
 * Extrait de MediaDetailScreen (règle 300 lignes). `twoCol` bascule l'agencement
 * portrait (poster+méta en rangée, poster débordant le backdrop) → paysage (empilé
 * dans le rail gauche figé).
 */
export function DetailHeader({ item, twoCol, isEpisode, seriesWatchState, posterW, posterH, actions, anims }: Props) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const client = useJellyfinClient();

  const isSeries = item.Type === "Series";
  const posterId = isEpisode ? (item.SeriesId ?? item.Id) : item.Id;
  const poster = client.getImageUrl(posterId, "Primary", { height: 500, quality: 90 });
  const isWatched = item.UserData?.Played === true;
  const year = item.ProductionYear;
  const rating = item.CommunityRating?.toFixed(1);
  const runtimeMin = item.RunTimeTicks ? Math.round(ticksToSeconds(item.RunTimeTicks) / 60) : null;
  const posTicks = item.UserData?.PlaybackPositionTicks ?? 0;
  const hasResume = posTicks > 0;
  const progress = item.UserData?.PlayedPercentage ? item.UserData.PlayedPercentage / 100 : 0;

  const seriesEp = isSeries && seriesWatchState?.type !== "completed" ? seriesWatchState?.episode : null;
  const playTargetId = seriesEp?.Id ?? (isSeries ? null : item.Id);
  const playLabel = seriesEp
    ? buildSeriesPlayLabel(seriesEp, t)
    : (hasResume ? t("resumeAt", { time: formatTime(ticksToSeconds(posTicks)) }) : t("play"));

  const posterEl = (
    <Animated.View style={[{ width: posterW, height: posterH }, ENABLE_SHARED_POSTER_TRANSITION ? undefined : anims.posterStyle]}>
      <Animated.Image
        source={{ uri: poster }}
        style={{ width: posterW, height: posterH, borderRadius: RADIUS.lg, backgroundColor: SURFACE.s2, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 20 }}
        resizeMode="cover"
        {...(ENABLE_SHARED_POSTER_TRANSITION ? { sharedTransitionTag: `poster-${posterId}` } : {})}
      />
      {isWatched && <View style={st.watchedRing}><Feather name="check" size={14} color="#000" /></View>}
    </Animated.View>
  );

  const metaEl = (
    <Animated.View style={anims.titleStyle}>
      {isEpisode && item.SeriesName && (
        item.SeriesId ? (
          <Pressable onPress={() => router.push(`/media/${item.SeriesId}`)} hitSlop={6} accessibilityRole="link" accessibilityLabel={item.SeriesName} style={st.seriesLink}>
            <Text numberOfLines={1} style={st.seriesLabel}>{item.SeriesName}</Text>
            <Feather name="chevron-right" size={14} color={BRAND.light} />
          </Pressable>
        ) : <Text numberOfLines={1} style={st.seriesLabel}>{item.SeriesName}</Text>
      )}
      <Text style={st.title} numberOfLines={3}>
        {isEpisode && item.IndexNumber != null ? `S${String(item.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(item.IndexNumber).padStart(2, "0")} · ` : ""}{item.Name}
      </Text>
      <Animated.View style={[st.metaRow, anims.metaStyle]}>
        {year && <Text style={st.metaItem}>{year}</Text>}
        {runtimeMin != null && runtimeMin > 0 && <Text style={st.metaDot}>·</Text>}
        {runtimeMin != null && runtimeMin > 0 && <Text style={st.metaItem}>{t("minutesShort", { count: runtimeMin })}</Text>}
        {rating && <Text style={st.metaDot}>·</Text>}
        {rating && (
          <View style={st.ratingRow}><Feather name="star" size={11} color={STATUS.rating} /><Text style={st.ratingTxt}>{rating}</Text></View>
        )}
        {isSeries && item.ChildCount != null && item.ChildCount > 0 && (
          <Text style={st.metaItem}>· {t("seasonsCount", { count: item.ChildCount })}</Text>
        )}
      </Animated.View>
      <Animated.View style={anims.metaStyle}><MetaTokens item={item} /></Animated.View>
    </Animated.View>
  );

  const playEl = playTargetId ? (
    <Animated.View style={[{ marginTop: spacing.xl }, anims.actionsStyle]}>
      <View style={{ width: "100%", maxWidth: 420 }}>
        <Pressable style={({ pressed }) => [st.playBtn, pressed && { opacity: 0.85 }]} onPress={() => router.push(`/watch/${playTargetId}`)} accessibilityRole="button" accessibilityLabel={`${playLabel} ${item.Name}`}>
          <Feather name="play" size={20} color={CTA.primaryFg} fill={CTA.primaryFg} />
          <Text style={st.playBtnTxt} numberOfLines={1}>{playLabel}</Text>
        </Pressable>
        {!isSeries && hasResume && <ProgressBar progress={progress} style={{ marginTop: 10 }} tint={BRAND.violet} />}
      </View>
    </Animated.View>
  ) : null;

  const actionsEl = (
    <Animated.View style={anims.actionsStyle}>
      <DetailActionsRow {...actions} />
    </Animated.View>
  );

  if (twoCol) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        {posterEl}
        <View style={{ marginTop: spacing.md }}>{metaEl}</View>
        {playEl}
        {actionsEl}
      </View>
    );
  }

  return (
    <>
      <View style={{ flexDirection: "row", paddingHorizontal: spacing.screenPadding, marginTop: -(posterH * 0.55) }}>
        {posterEl}
        <View style={{ flex: 1, marginLeft: spacing.lg, justifyContent: "flex-end" }}>{metaEl}</View>
      </View>
      <View style={{ paddingHorizontal: spacing.screenPadding }}>{playEl}</View>
      {actionsEl}
    </>
  );
}
