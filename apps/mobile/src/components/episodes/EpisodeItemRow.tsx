import { useCallback, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useWatchedToggle, type useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { FONT_FAMILY, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { MetaTokens } from "../detail/MetaTokens";
import { EpisodeThumb } from "./EpisodeThumb";

let Haptics: { impactAsync: (style: unknown) => void; ImpactFeedbackStyle: { Light: unknown } } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* module natif absent */ }

const THUMB_W = 110;
const THUMB_H = 62;

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
  const st = useThemedStyles(makeStyles);
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

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", backgroundColor: t.colors.fill.faint, borderRadius: 10, overflow: "hidden", minHeight: THUMB_H },
    main: { flexDirection: "row", flex: 1 },
    thumb: { width: THUMB_W, height: THUMB_H, alignSelf: "center", backgroundColor: t.colors.surface.s2, borderRadius: 6, overflow: "hidden" },
    progressTrack: { position: "absolute", bottom: 0, left: 0, right: 0, height: 3, backgroundColor: t.colors.fill.strong },
    body: { flex: 1, padding: 10, justifyContent: "center" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    currentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.brand.accent },
    title: { flex: 1, color: t.colors.text.primary, fontSize: 13, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
    current: { fontSize: 10, fontFamily: FONT_FAMILY.bold, letterSpacing: 0.6, textTransform: "uppercase" },
    runtime: { color: t.colors.text.quaternary, fontSize: 11 },
    overview: { color: t.colors.text.quaternary, fontSize: 11, marginTop: 4, lineHeight: 15 },
    toggle: { paddingRight: 12, paddingLeft: 4 },
    ring: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    ringPlayed: {
      backgroundColor: withAlpha(t.colors.brand.accent, 0.15, t.colors.brand.soft),
      borderColor: withAlpha(t.colors.brand.accent, 0.45, t.colors.brand.glow),
    },
  });
