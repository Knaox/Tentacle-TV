import { useCallback, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useWatchedToggle, type useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { ProgressBar } from "@/components/ui";
import { WatchedGlyph } from "@/components/cards/cardGlyphs";
import { cardProgress } from "@/components/cards/cardProgress";
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
  /** L'appui long : la feuille des cartes (variante 16:9) sur la fiche ; rien dans le lecteur. */
  onLongPress?: (ep: MediaItem) => void;
}

/**
 * Une ligne d'épisode : vignette, numéro et titre, durée, résumé, et le rond
 * « vu ». Toucher lance l'épisode. Le rond dessine la coche de la pastille
 * d'états des cartes (tracé partagé, pleine quand l'épisode est vu), la barre
 * suit la règle commune (`cardProgress`).
 */
export function EpisodeItemRow({ ep, seriesId, seasonId, client, onPlay, isCurrent, leading, onLongPress }: Props) {
  const { t } = useTranslation("common");
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeEpisodeRowStyles);
  // Texte d'accent lisible : la nuance vive en sombre, la foncée en clair.
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
  const { markWatched, markUnwatched } = useWatchedToggle(ep.Id, { seriesId, seasonId });
  const played = ep.UserData?.Played === true;
  const progress = cardProgress(ep);
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
      <Pressable
        onPress={() => onPlay(ep)}
        onLongPress={onLongPress ? () => onLongPress(ep) : undefined}
        style={st.main}
      >
        <View style={st.thumb}>
          <EpisodeThumb ep={ep} seriesId={seriesId} client={client} />
          {progress !== null && (
            <View style={local.progress}>
              <ProgressBar progress={progress / 100} height={3} />
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

      {/* Le rond « vu » : la coche de la pastille d'états des cartes. */}
      <Pressable
        onPress={handleToggle}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={played ? t("markUnwatched") : t("markWatched")}
        accessibilityState={{ selected: played }}
        style={st.toggle}
      >
        <Animated.View style={[animStyle, local.watched]}>
          <WatchedGlyph size={26} color={played ? accentText : colors.text.tertiary} filled={played} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

// Propre à la ligne en ligne : sa jumelle hors ligne garde, pour l'instant,
// la piste et l'anneau des styles partagés (`episodeRowStyles`).
const local = StyleSheet.create({
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 4, paddingBottom: 4 },
  watched: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
});
