/**
 * Octave mobile — « Écoutés récemment » en tête de l'accueil : des tuiles à
 * relancer d'un toucher (la série reprend à ce titre), deux colonnes sur un
 * téléphone, trois sur une tablette, deux rangées PLEINES au plus (jamais une
 * tuile seule). Le titre en cours se reconnaît (barres, couleur).
 */

import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { typography, useTheme } from "@/theme";
import { usePagesCurrentKey, usePagesPlayer } from "../env/pagesPlayer";
import { openTrackSheet } from "../actions/trackSheetStore";
import { TrackStateMark } from "../../offline/TrackStateMark";
import { Artwork } from "../ui/Artwork";
import { NowPlayingBars } from "../ui/NowPlayingBars";
import { SectionTitle } from "../ui/Shelf";
import { quickPicksShown } from "./quickPicksRule";
import { usePageMetrics, accentTextOf } from "../ui/pageStyle";
import { playFrom } from "../env/playFrom";

const CONTEXT = "home:recent";


const Tile = memo(function Tile({ track, index, list, playing }: { track: MusicTrack; index: number; list: readonly MusicTrack[]; playing: boolean }) {
  const theme = useTheme();
  const player = usePagesPlayer();
  const { t } = useTranslation("music");
  const play = useCallback(() => playFrom(player, list, index, CONTEXT), [index, list, player]);
  const accent = accentTextOf(theme);
  return (
    <Pressable
      onPress={play}
      onLongPress={() => openTrackSheet({ track, list, contextId: CONTEXT })}
      accessibilityRole="button"
      accessibilityLabel={t("track.play", { title: track.title })}
      style={({ pressed }) => [styles.tile, { backgroundColor: pressed ? theme.colors.fill.soft : theme.colors.fill.faint }]}
    >
      <Artwork url={track.artworkUrl} size={52} radius={6} />
      <View style={styles.tileText}>
        <Text numberOfLines={1} style={[typography.bodyBold, { fontSize: 14, color: playing ? accent : theme.colors.text.primary }]}>
          {track.title}
        </Text>
        <View style={styles.sub}>
          <TrackStateMark track={track} size={11} />
          <Text numberOfLines={1} style={[typography.caption, styles.flex, { color: theme.colors.text.tertiary }]}>
            {track.artists.map((a) => a.name).join(", ")}
          </Text>
        </View>
      </View>
      {playing ? <NowPlayingBars color={accent} /> : null}
    </Pressable>
  );
});

export const QuickPicks = memo(function QuickPicks({ tracks }: { tracks: readonly MusicTrack[] }) {
  const { t } = useTranslation("music");
  const current = usePagesCurrentKey();
  const { gutter, isTablet } = usePageMetrics();
  const columns = isTablet ? 3 : 2;
  const shown = tracks.slice(0, quickPicksShown(tracks.length, columns));
  return (
    <View>
      <SectionTitle title={t("home.recentlyPlayed")} />
      <View style={[styles.grid, { paddingHorizontal: gutter }]}>
        {shown.map((track, i) => (
          <View key={track.key} style={{ width: `${100 / columns}%`, padding: 4 }}>
            <Tile track={track} index={i} list={tracks} playing={current === track.key} />
          </View>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  tile: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, paddingRight: 10, overflow: "hidden", minHeight: 52 },
  tileText: { flex: 1, minWidth: 0, gap: 1 },
  sub: { flexDirection: "row", alignItems: "center", gap: 4 },
  flex: { flex: 1 },
});
