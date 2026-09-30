import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CardMarkerLayer } from "../../cards/CardMarkerLayer";
import { EMPTY_MARKERS } from "../../cards/cardTypes";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { colors, fonts, white } from "../../theme/tokens";
import { DualTone, TONES } from "./DualTone";
import type { EpisodeRowModel } from "./playerTypes";

/**
 * Une grande ligne d'épisode : la vignette (jauge ambre s'il est entamé,
 * pastille « vu » du modèle des cartes), « Épisode 3 · 59 min · date », le
 * titre sur deux lignes, le début du résumé. L'épisode EN COURS porte sa
 * pastille ambre. Au focus, la ligne devient blanche, texte noir, et grandit
 * un peu — jamais d'anneau.
 *
 * Hauteur FIXE (`EPISODE_ROW_HEIGHT`) : le panneau calcule son défilement
 * au point près.
 */

const THUMB = { width: 256, height: 144 };
const PAD = 16;
export const EPISODE_ROW_HEIGHT = THUMB.height + PAD * 2;
const WATCHED = { ...EMPTY_MARKERS, statuses: ["watched" as const] };

export const EpisodeRow = memo(function EpisodeRow({
  episode,
  nowPlayingLabel,
  focusKey,
  onPress,
}: {
  episode: EpisodeRowModel;
  nowPlayingLabel: string;
  focusKey: string;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} accessibilityLabel={episode.title}>
      {(focused) => <Body episode={episode} nowPlayingLabel={nowPlayingLabel} focused={focused} />}
    </FocusTarget>
  );
});

function Body({ episode, nowPlayingLabel, focused }: { episode: EpisodeRowModel; nowPlayingLabel: string; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.025 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={[styles.row, lift]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, whiteLayer]} />
      <View style={[StyleSheet.absoluteFill, styles.rest, episode.current && styles.current]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.white, whiteLayer]} />
      <View style={styles.thumb}>
        {episode.imageUri ? <Image source={{ uri: episode.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
        <CardMarkerLayer markers={episode.watched ? WATCHED : EMPTY_MARKERS} progress={episode.watched ? undefined : episode.progress} compact />
      </View>
      <DualTone progress={p} style={styles.text} contentStyle={styles.textContent}>
        {(tone) => (
          <>
            <View style={styles.kickerRow}>
              <Text style={[styles.kicker, { color: TONES[tone].tertiary }]} numberOfLines={1}>{episode.kicker}</Text>
              {episode.current ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText} numberOfLines={1}>{nowPlayingLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.title, { color: TONES[tone].primary }]} numberOfLines={2}>{episode.title}</Text>
            {episode.overview ? (
              <Text style={[styles.overview, { color: TONES[tone].secondary }]} numberOfLines={1}>{episode.overview}</Text>
            ) : null}
          </>
        )}
      </DualTone>
    </Animated.View>
  );
}

const RADIUS = 26;

const styles = StyleSheet.create({
  row: { height: EPISODE_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 24, padding: PAD, borderRadius: RADIUS },
  rest: { borderRadius: RADIUS, backgroundColor: white(0.05) },
  current: { backgroundColor: white(0.12), borderWidth: 1, borderColor: white(0.16) },
  white: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  thumb: { ...THUMB, borderRadius: 16, overflow: "hidden", backgroundColor: colors.surface3 },
  text: { flex: 1, alignSelf: "stretch" },
  textContent: { flex: 1, gap: 6, justifyContent: "center" },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  kicker: { ...fonts.semibold, fontSize: 23, flexShrink: 1 },
  badge: { height: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: colors.accent },
  badgeText: { ...fonts.bold, fontSize: 22, color: colors.onAccent },
  title: { ...fonts.bold, fontSize: 28, lineHeight: 34 },
  overview: { ...fonts.regular, fontSize: 24, lineHeight: 30 },
});
