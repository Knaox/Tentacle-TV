import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatEpisodeCode, type MediaItem } from "@tentacle-tv/shared";
import { isInProgress, watchStateOf } from "@tentacle-tv/offline-core";
import { MetaTokens } from "@/components/detail/MetaTokens";
import { makeEpisodeRowStyles } from "@/components/episodes/episodeRowStyles";
import { useLocalSnapshotJson } from "@/hooks/offline/useLocalSnapshot";
import { useLocalTrickplay } from "@/hooks/offline/useLocalTrickplay";
import type { OfflineEntry } from "@/offline/engineApi";
import { formatBytes } from "@/offline/formatBytes";
import { variantLabel } from "@/offline/manage/OfflineEntryRow";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { EPISODE_ART } from "./offlineArt";
import { OfflineLocalImage } from "./OfflineLocalImage";
import { ResumeSpriteImage } from "./ResumeSpriteImage";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: { Light: unknown } } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* module natif absent */ }

interface Props {
  entry: OfflineEntry;
  isCurrent?: boolean;
  onPlay: (entry: OfflineEntry) => void;
  onMore: (entry: OfflineEntry) => void;
  onToggleWatched: (entry: OfflineEntry, played: boolean) => void;
}

const TICKS_PER_MINUTE = 600_000_000;

/**
 * Une ligne d'épisode gardé sur l'appareil — le dessin d'`EpisodeItemRow` :
 * vignette (l'image EXACTE de la reprise quand l'épisode est entamé), piste
 * de progression dégradée, « S01E03 · Titre », durée et version, jetons de
 * qualité, synopsis, le rond « vu » (local) et « ⋯ » vers la feuille.
 */
export const OfflineEpisodeRow = memo(function OfflineEpisodeRow({ entry, isCurrent, onPlay, onMore, onToggleWatched }: Props) {
  const { t } = useTranslation(["common", "offline", "downloads"]);
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeEpisodeRowStyles);
  const ex = useThemedStyles(makeExtraStyles);
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
  const { data: item } = useLocalSnapshotJson<MediaItem>(entry.itemId, "item.json");
  const local = useLocalTrickplay(isInProgress(entry) ? entry.itemId : undefined);
  const { watched, percent } = watchStateOf(entry);
  const title = item?.Name ?? entry.title ?? entry.itemId;
  const code = entry.parentIndexNumber != null && entry.indexNumber != null
    ? `${formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })} · `
    : "";
  const runtime = entry.runtimeTicks ? Math.round(entry.runtimeTicks / TICKS_PER_MINUTE) : null;
  const version = [variantLabel(entry, (key) => t(`downloads:${key}`), (key) => t(`offline:${key}`)), formatBytes(entry.bytesDone)].join(" · ");
  const overview = (item?.Overview ?? "").replace(/<[^>]+>/g, "").trim();

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const handleToggle = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.7, { damping: 8, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
    });
    onToggleWatched(entry, !watched);
  }, [entry, watched, onToggleWatched, scale]);

  return (
    <View style={st.row} collapsable={false}>
      <Pressable onPress={() => onPlay(entry)} style={st.main} accessibilityRole="button" accessibilityLabel={`${code}${title}`}>
        <View style={st.thumb}>
          <View style={ex.fallback}>
            <Text style={ex.fallbackText}>{entry.indexNumber != null ? `E${entry.indexNumber}` : title.charAt(0).toUpperCase()}</Text>
          </View>
          <OfflineLocalImage itemId={entry.itemId} candidates={EPISODE_ART} style={StyleSheet.absoluteFill} />
          {local && <ResumeSpriteImage local={local} positionTicks={entry.positionTicks} />}
          {percent !== null && percent > 0 && (
            <View style={st.progressTrack}>
              <LinearGradient colors={[colors.brand.violet, colors.brand.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: "100%", width: `${percent}%` }} />
            </View>
          )}
        </View>
        <View style={st.body}>
          <View style={st.titleRow}>
            {isCurrent && <View style={st.currentDot} />}
            <Text numberOfLines={1} style={[st.title, isCurrent && { fontWeight: "800" }]}>{code}{title}</Text>
          </View>
          <View style={st.metaRow}>
            {isCurrent && <Text style={[st.current, { color: accentText }]}>{t("common:currentEpisode")}</Text>}
            {runtime ? <Text style={st.runtime}>{t("common:minutesShort", { count: runtime })}</Text> : null}
            <Text style={st.runtime} numberOfLines={1}>{version}</Text>
          </View>
          <MetaTokens item={item ?? undefined} compact />
          {overview.length > 0 && <Text numberOfLines={2} style={st.overview}>{overview}</Text>}
        </View>
      </Pressable>

      <Pressable onPress={() => onMore(entry)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t("offline:manage")} style={ex.more}>
        <Feather name="more-horizontal" size={18} color={colors.text.secondary} />
      </Pressable>

      <Pressable
        onPress={handleToggle}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={watched ? t("common:markUnwatched") : t("common:markWatched")}
        style={st.toggle}
      >
        <Animated.View style={[animStyle, st.ring, watched && st.ringPlayed]} collapsable={false}>
          <Feather name="check" size={16} color={watched ? accentText : colors.text.disabled} />
        </Animated.View>
      </Pressable>
    </View>
  );
});

const makeExtraStyles = (t: AppTheme) =>
  StyleSheet.create({
    fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
    fallbackText: { fontSize: 14, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
    more: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  });
