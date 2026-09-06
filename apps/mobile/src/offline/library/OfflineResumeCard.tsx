import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { formatEpisodeCode } from "@tentacle-tv/shared";
import { remainingTicks, watchStateOf } from "@tentacle-tv/offline-core";
import { GradientOverlay, PressableCard, ProgressBar } from "@/components/ui";
import { useLocalTrickplay } from "@/hooks/offline/useLocalTrickplay";
import type { OfflineEntry } from "@/offline/engineApi";
import { typography, RADIUS, SHADOW_RN, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { EPISODE_ART, ITEM_BANNER_ART } from "./offlineArt";
import { OfflineLocalImage } from "./OfflineLocalImage";
import { ResumeSpriteImage } from "./ResumeSpriteImage";

interface Props {
  entry: OfflineEntry;
  width: number;
  /** La carte LANCE la lecture — la sémantique de la rangée « Reprendre » en ligne. */
  onPress: (entry: OfflineEntry) => void;
  onLongPress: (entry: OfflineEntry) => void;
}

const TICKS_PER_MINUTE = 600_000_000;

/**
 * Une carte 16:9 de la rangée « Reprendre » : l'IMAGE EXACTE de la reprise
 * (la case trickplay de la barre de lecture, rognée dans une planche du
 * disque), le disque de lecture, la barre de progression, puis le titre et
 * « S01E03 · 12 min restantes ». Zéro réseau.
 */
export const OfflineResumeCard = memo(function OfflineResumeCard({ entry, width, onPress, onLongPress }: Props) {
  const { t } = useTranslation("offline");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const local = useLocalTrickplay(entry.itemId);
  const { percent } = watchStateOf(entry);
  const isEpisode = entry.kind === "episode";
  const title = isEpisode ? (entry.seriesName ?? entry.title ?? entry.itemId) : (entry.title ?? entry.itemId);
  const code = isEpisode && entry.parentIndexNumber != null && entry.indexNumber != null
    ? formatEpisodeCode(entry.parentIndexNumber, entry.indexNumber, { style: "padded" })
    : null;
  const minutesLeft = Math.round(remainingTicks(entry) / TICKS_PER_MINUTE);
  const caption = [code, minutesLeft > 0 ? t("minutesLeft", { count: minutesLeft }) : null].filter(Boolean).join(" · ");

  return (
    <PressableCard
      onPress={() => onPress(entry)}
      onLongPress={() => onLongPress(entry)}
      style={{ width }}
      accessibilityRole="button"
      accessibilityLabel={`${title}${caption ? `, ${caption}` : ""}`}
    >
      <View style={st.thumb}>
        <View style={st.clip} pointerEvents="none">
          <View style={st.fallback}>
            <Text style={st.fallbackText}>{entry.indexNumber != null ? `E${entry.indexNumber}` : title.charAt(0).toUpperCase()}</Text>
          </View>
          <OfflineLocalImage itemId={entry.itemId} candidates={isEpisode ? EPISODE_ART : ITEM_BANNER_ART} style={StyleSheet.absoluteFill} />
          {local && <ResumeSpriteImage local={local} positionTicks={entry.positionTicks} />}
          <GradientOverlay direction="bottom" height="70%" intensity="soft" color={`rgb(${theme.colors.onMedia.scrimRgb})`} />
        </View>
        <View style={st.play} collapsable={false}>
          <Feather name="play" size={18} color={theme.colors.onMedia.primary} style={{ marginLeft: 2 }} />
        </View>
        {percent !== null && (
          <View style={st.progWrap}>
            <ProgressBar progress={percent / 100} height={3} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={st.title}>{title}</Text>
      {caption ? <Text numberOfLines={1} style={st.caption}>{caption}</Text> : null}
    </PressableCard>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    thumb: { aspectRatio: 16 / 9, borderRadius: RADIUS.lg, backgroundColor: t.colors.surface.s2, ...SHADOW_RN.elev2 },
    clip: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg, overflow: "hidden", backgroundColor: t.colors.surface.s2 },
    fallback: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
    fallbackText: { fontSize: 18, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary },
    play: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 36,
      height: 36,
      marginTop: -18,
      marginLeft: -18,
      borderRadius: 18,
      backgroundColor: t.colors.overlay.scrim,
      borderWidth: 1,
      borderColor: t.colors.onMedia.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    progWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 6, paddingBottom: 6 },
    title: { ...typography.small, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary, marginTop: 8, letterSpacing: -0.1 },
    caption: { ...typography.badge, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 2 },
  });
