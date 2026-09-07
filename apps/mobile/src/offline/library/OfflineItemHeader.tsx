import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatEpisodeCode, ticksToSeconds, type MediaItem } from "@tentacle-tv/shared";
import { watchStateOf } from "@tentacle-tv/offline-core";
import { MetaTokens } from "@/components/detail/MetaTokens";
import { formatTime } from "@/components/detail/computeBadges";
import { ProgressBar } from "@/components/ui";
import type { useMediaDetailAnimations } from "@/hooks/useMediaDetailAnimations";
import type { OfflineEntry } from "@/offline/engineApi";
import { makeMediaDetailStyles } from "@/screens/mediaDetailStyles";
import { spacing, typography, RADIUS, useTheme, useThemedStyles } from "@/theme";
import type { OfflineDetailMetrics } from "./OfflineDetailShell";
import { MOVIE_ART, SERIES_ART } from "./offlineArt";
import { OfflineLocalImage } from "./OfflineLocalImage";

interface Props {
  entry: OfflineEntry;
  item: MediaItem | undefined;
  seriesKey: string | null;
  seasonKey: string | null;
  remainingMinutes: number;
  metrics: OfflineDetailMetrics;
  anims: ReturnType<typeof useMediaDetailAnimations>;
  onPlay: (entry: OfflineEntry) => void;
}

const TICKS_PER_MINUTE = 600_000_000;

/**
 * Le bloc « hero » de la fiche locale d'un titre — le jumeau de
 * `DetailHeader` : affiche (celle de la série pour un épisode), lien vers la
 * série locale, « S01E03 · Titre », méta, jetons de qualité, pilule
 * « Reprendre à 12:30 » avec la barre et les minutes restantes.
 */
export function OfflineItemHeader({ entry, item, seriesKey, seasonKey, remainingMinutes, metrics, anims, onPlay }: Props) {
  const router = useRouter();
  const { t } = useTranslation(["common", "offline", "downloads"]);
  const theme = useTheme();
  const st = useThemedStyles(makeMediaDetailStyles);
  const { posterW, posterH, twoCol } = metrics;
  const isEpisode = entry.kind === "episode";
  const title = item?.Name ?? entry.title ?? entry.itemId;
  const seriesName = entry.seriesName ?? item?.SeriesName ?? null;
  const code = isEpisode && entry.parentIndexNumber != null && entry.indexNumber != null
    ? `${formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })} · `
    : "";
  const year = item?.ProductionYear;
  const rating = item?.CommunityRating?.toFixed(1);
  const runtimeTicks = item?.RunTimeTicks ?? entry.runtimeTicks ?? 0;
  const runtimeMin = runtimeTicks > 0 ? Math.round(runtimeTicks / TICKS_PER_MINUTE) : null;
  const { watched, percent } = watchStateOf(entry);
  const hasResume = !watched && entry.positionTicks > 0;
  const playLabel = hasResume
    ? t("common:resumeAt", { time: formatTime(ticksToSeconds(entry.positionTicks)) })
    : isEpisode ? t("downloads:episodePlay") : t("common:play");

  const openSeries = () => {
    if (seriesKey === null) return;
    router.push({ pathname: "/on-device/series/[seriesKey]", params: { seriesKey, ...(seasonKey ? { season: seasonKey } : {}) } } as never);
  };

  const posterEl = (
    <Animated.View style={[{ width: posterW, height: posterH }, anims.posterStyle]}>
      <View style={{ width: posterW, height: posterH, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: theme.colors.surface.s2, shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 20 }}>
        <OfflineLocalImage itemId={entry.itemId} candidates={isEpisode ? SERIES_ART : MOVIE_ART} style={StyleSheet.absoluteFill} />
      </View>
      {watched && <View style={st.watchedRing}><Feather name="check" size={14} color={theme.colors.cta.primaryFg} /></View>}
    </Animated.View>
  );

  const metaEl = (
    <Animated.View style={anims.titleStyle}>
      {isEpisode && seriesName && (
        seriesKey ? (
          <Pressable onPress={openSeries} hitSlop={6} accessibilityRole="link" accessibilityLabel={seriesName} style={st.seriesLink}>
            <Text numberOfLines={1} style={st.seriesLabel}>{seriesName}</Text>
            <Feather name="chevron-right" size={14} color={theme.colors.brand.light} />
          </Pressable>
        ) : <Text numberOfLines={1} style={st.seriesLabel}>{seriesName}</Text>
      )}
      <Text style={st.title} numberOfLines={3}>{code}{title}</Text>
      <Animated.View style={[st.metaRow, anims.metaStyle]}>
        {year != null && <Text style={st.metaItem}>{year}</Text>}
        {year != null && runtimeMin != null && <Text style={st.metaDot}>·</Text>}
        {runtimeMin != null && <Text style={st.metaItem}>{t("common:minutesShort", { count: runtimeMin })}</Text>}
        {rating && <Text style={st.metaDot}>·</Text>}
        {rating && (
          <View style={st.ratingRow}><Feather name="star" size={11} color={theme.colors.status.rating} /><Text style={st.ratingTxt}>{rating}</Text></View>
        )}
      </Animated.View>
      <Animated.View style={anims.metaStyle}><MetaTokens item={item} /></Animated.View>
    </Animated.View>
  );

  const playEl = (
    <Animated.View style={[{ marginTop: spacing.xl }, anims.actionsStyle]}>
      <View style={{ width: "100%", maxWidth: 420 }}>
        <Pressable style={({ pressed }) => [st.playBtn, pressed && { opacity: 0.85 }]} onPress={() => onPlay(entry)} accessibilityRole="button" accessibilityLabel={`${playLabel} ${title}`}>
          <Feather name="play" size={20} color={theme.colors.cta.primaryFg} fill={theme.colors.cta.primaryFg} />
          <Text style={st.playBtnTxt} numberOfLines={1}>{playLabel}</Text>
        </Pressable>
        {hasResume && percent !== null && <ProgressBar progress={percent / 100} style={{ marginTop: 10 }} />}
        {hasResume && remainingMinutes > 0 && (
          <Text style={{ ...typography.caption, color: theme.colors.text.tertiary, marginTop: 6 }}>{t("offline:minutesLeft", { count: remainingMinutes })}</Text>
        )}
      </View>
    </Animated.View>
  );

  if (twoCol) {
    return (
      <View style={{ paddingHorizontal: spacing.lg }}>
        {posterEl}
        <View style={{ marginTop: spacing.md }}>{metaEl}</View>
        {playEl}
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
    </>
  );
}
