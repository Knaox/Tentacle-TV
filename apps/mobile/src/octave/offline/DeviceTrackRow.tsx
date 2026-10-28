/**
 * Octave (mobile) — une rangée de « Sur cet appareil » : la pochette gardée
 * (locale, sans réseau), le titre, l'artiste, la marque d'état. Hauteur FIXE
 * (`DEVICE_ROW_HEIGHT`) : la liste se virtualise sans mesurer.
 */

import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import type { MusicTrack } from "@tentacle-tv/shared/music";
import { PressableScale } from "../layout/PressableScale";
import { useOctaveColors } from "../theme/octaveColors";
import { TrackStateMark } from "./TrackStateMark";

export const DEVICE_ROW_HEIGHT = 64;

interface Props {
  track: MusicTrack;
  index: number;
  onPlay: (index: number) => void;
}

export const DeviceTrackRow = memo(function DeviceTrackRow({ track, index, onPlay }: Props) {
  const colors = useOctaveColors();
  const artist = track.artists.map((a) => a.name).join(", ");
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={artist ? `${track.title}, ${artist}` : track.title} onPress={() => onPlay(index)} style={styles.row}>
      <View style={[styles.art, { backgroundColor: colors.raised }]}>
        {track.artworkUrl ? <Image source={{ uri: track.artworkUrl }} style={styles.art} contentFit="cover" recyclingKey={track.key} transition={120} /> : null}
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{track.title}</Text>
        {artist ? <Text style={[styles.artist, { color: colors.textSecondary }]} numberOfLines={1}>{artist}</Text> : null}
      </View>
      <TrackStateMark track={track} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  row: { height: DEVICE_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 12 },
  art: { width: 48, height: 48, borderRadius: 8, overflow: "hidden" },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: "600" },
  artist: { fontSize: 14 },
});
