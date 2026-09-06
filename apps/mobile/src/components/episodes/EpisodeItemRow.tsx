import { useCallback, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useWatchedToggle, type useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { useTheme, useThemedStyles } from "@/theme";
import { MetaTokens } from "../detail/MetaTokens";
import { makeEpisodeRowStyles } from "./episodeRowStyles";
import { EpisodeThumb } from "./EpisodeThumb";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: { Light: unknown } } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* module natif absent */ }

interface Props {
  ep: MediaItem;
  seriesId: string;
  seasonId: string;
  client: ReturnType<typeof useJellyfinClient>;
  onPlay: (ep: MediaItem) => void;
  isCurrent?: boolean;
  /** À gauche du rond « vu » : le bouton « Garder hors ligne » de l'épisode. */
  leading?: ReactNode;
}

/** Une ligne d'épisode : vignette, numéro et titre, durée, résumé, et le rond « vu ». */
export function EpisodeItemRow({ ep, seriesId, seasonId, client, onPlay, isCurrent, leading }: Props) {
  const { t } = useTranslation("common");
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeEpisodeRowStyles);
  // Texte d'accent lisible : la nuance vive en sombre, la foncée en clair.
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const played = ep.UserData?.Played === true;
  const progress = ep.UserData?.PlayedPercentage;
  const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
  const epLabel = ep.IndexNumber != null
    ? `S${String(ep.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(ep.IndexNumber).padStart(2, "0")} · `
    : "";

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handleToggle = useCallback(() => {
    Haptics?.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.7, { damping: 8, stiffness: 300 }, () => {
      scale.value = withSpring(1, { damping: 8, stiffness: 300 });
    });
    if (played) markUnwatched.mutate();
    else markWatched.mutate();
  }, [played, markWatched, markUnwatched, scale]);

  return (
    <View style={st.row}>
      <Pressable onPress={() => onPlay(ep)} style={st.main}>
        <View style={st.thumb}>
          <EpisodeThumb ep={ep} seriesId={seriesId} client={client} />
          {progress != null && progress > 0 && (
            <View style={st.progressTrack}>
              <LinearGradient
                colors={[colors.brand.violet, colors.brand.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: "100%", width: `${progress}%` }}
              />
            </View>
          )}
        </View>
        <View style={st.body}>
          <View style={st.titleRow}>
            {isCurrent && <View style={st.currentDot} />}
            <Text numberOfLines={1} style={[st.title, isCurrent && { fontWeight: "800" }]}>
              {epLabel}{ep.Name}
            </Text>
          </View>
          <View style={st.metaRow}>
            {isCurrent && <Text style={[st.current, { color: accentText }]}>{t("currentEpisode")}</Text>}
            {runtime && <Text style={st.runtime}>{t("minutesShort", { count: runtime })}</Text>}
          </View>
          <MetaTokens item={ep} compact />
          {ep.Overview && <Text numberOfLines={2} style={st.overview}>{ep.Overview}</Text>}
        </View>
      </Pressable>

      {leading}

      {/* Le rond « vu » */}
      <Pressable
        onPress={handleToggle}
        hitSlop={12}
        accessibilityLabel={played ? t("markUnwatched") : t("markWatched")}
        style={st.toggle}
      >
        <Animated.View style={[animStyle, st.ring, played && st.ringPlayed]}>
          <Feather name="check" size={16} color={played ? accentText : colors.text.disabled} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
