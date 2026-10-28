/**
 * Octave mobile — une rangée de titre : pochette (ou numéro sur la page d'un
 * album), titre, artistes, le titre EN COURS marqué (couleur et barres
 * animées), le cœur affiché tout de suite (`useLiked`), un « ⋯ » à 44 pt.
 * Toucher : lire depuis ce titre (la liste garde la suite) ; appui maintenu ou
 * « ⋯ » : la feuille d'actions. Hauteur FIXE (`TRACK_ROW_HEIGHT`) : les listes
 * virtualisées connaissent la place de chaque rangée.
 */

import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Heart, MoreHorizontal } from "lucide-react-native";
import { useLiked } from "@tentacle-tv/api-client";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { haptic as playHaptic } from "@/utils/haptics";
import { openTrackSheet } from "../actions/trackSheetStore";
import { Artwork } from "./Artwork";
import { NowPlayingBars } from "./NowPlayingBars";
import { accentTextOf } from "./pageStyle";

export const TRACK_ROW_HEIGHT = 60;

interface TrackRowProps {
  track: MusicTrack;
  index: number;
  list: readonly MusicTrack[];
  contextId: string | null;
  playing: boolean;
  onPlay: (index: number) => void;
  /** Le numéro de piste à la place de la pochette (page d'album). */
  numbered?: boolean;
  gutter: number;
  hide?: { album?: boolean; artist?: boolean };
}

export const TrackRow = memo(function TrackRow({ track, index, list, contextId, playing, onPlay, numbered, gutter, hide }: TrackRowProps) {
  const theme = useTheme();
  const { t } = useTranslation("music");
  const liked = useLiked(track.key, track.favorite);
  const sheet = useCallback(() => {
    playHaptic("longPress");
    openTrackSheet({ track, list, contextId, hide });
  }, [contextId, hide, list, track]);
  const artists = track.artists.map((a) => a.name).join(", ");
  const accent = accentTextOf(theme);
  return (
    <Pressable
      onPress={() => onPlay(index)}
      onLongPress={sheet}
      delayLongPress={350}
      style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
      accessibilityRole="button"
      accessibilityLabel={t("track.play", { title: track.title })}
      accessibilityHint={artists}
      accessibilityState={{ selected: playing }}
    >
      {numbered ? (
        <View style={styles.number}>
          {playing ? <NowPlayingBars color={accent} /> : <Text style={[typography.caption, { color: theme.colors.text.tertiary }]}>{track.trackNumber ?? index + 1}</Text>}
        </View>
      ) : (
        <View>
          <Artwork url={track.artworkUrl} size={44} radius={6} />
          {playing ? (
            <View style={[StyleSheet.absoluteFill, styles.overlay]}>
              <NowPlayingBars color="#fff" />
            </View>
          ) : null}
        </View>
      )}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[typography.bodyBold, { color: playing ? accent : theme.colors.text.primary }]}>
          {track.title}
        </Text>
        <View style={styles.sub}>
          {liked ? <Heart size={11} color={accent} fill={accent} accessibilityLabel={t("track.unlike")} /> : null}
          <Text numberOfLines={1} style={[typography.caption, styles.flex, { color: theme.colors.text.tertiary }]}>
            {artists}
          </Text>
        </View>
      </View>
      <Pressable onPress={sheet} hitSlop={8} style={styles.more} accessibilityRole="button" accessibilityLabel={t("track.more", { title: track.title })}>
        <MoreHorizontal size={20} color={theme.colors.text.secondary} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: { height: TRACK_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 },
  number: { width: 28, alignItems: "center" },
  overlay: { backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 6, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  sub: { flexDirection: "row", alignItems: "center", gap: 4 },
  flex: { flex: 1 },
  more: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
});
