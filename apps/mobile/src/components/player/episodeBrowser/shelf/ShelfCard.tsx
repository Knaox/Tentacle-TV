import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { SHELF_TYPE } from "../../../../player/episodes/episodeBrowserLayout";
import { EB, EB_TYPE } from "../browserTokens";
import { EpisodeArtwork } from "../EpisodeArtwork";
import { WholeText } from "../WholeText";
import type { EpisodeWords } from "../useEpisodeWords";

interface Props {
  entry: EpisodeEntry;
  width: number;
  overviewLines: 0 | 2;
  large: boolean;
  artwork: ReactNode;
  words: EpisodeWords;
  onPlay: (entry: EpisodeEntry) => void;
}

/**
 * Une carte de l'étagère, comme l'app TV d'Apple : la grande vignette, puis
 * « Épisode 6 · Reste 7 min » en gris, le titre, et — là où il tient — le
 * début du résumé. L'épisode en cours porte « En cours » DANS l'image.
 */
export const ShelfCard = memo(function ShelfCard({ entry, width, overviewLines, large, artwork, words, onPlay }: Props) {
  return (
    <Pressable
      onPress={() => onPlay(entry)}
      accessibilityRole="button"
      accessibilityState={{ selected: entry.current }}
      accessibilityLabel={words.spoken(entry)}
      style={({ pressed }) => [{ width }, pressed && st.pressed]}
    >
      <EpisodeArtwork entry={entry} width={width} radius={large ? 14 : 12} artwork={artwork} badge />
      <View style={st.caption}>
        <Text numberOfLines={1} style={st.kicker}>{words.kicker(entry)}</Text>
        <Text numberOfLines={2} style={[st.title, large && st.titleLarge]}>{entry.title}</Text>
        {overviewLines > 0 && entry.overview ? (
          <WholeText text={entry.overview} lines={overviewLines} style={st.overview} />
        ) : null}
      </View>
    </Pressable>
  );
});

const st = StyleSheet.create({
  pressed: { opacity: 0.86, transform: [{ scale: 0.97 }] },
  caption: { paddingTop: 10, paddingHorizontal: 2, gap: 4 },
  kicker: { color: EB.secondary, fontSize: EB_TYPE.kicker, lineHeight: SHELF_TYPE.kicker, fontWeight: "600", fontVariant: ["tabular-nums"] },
  title: { color: EB.label, fontSize: EB_TYPE.title, lineHeight: SHELF_TYPE.titleLine, fontWeight: "600", letterSpacing: -0.15 },
  titleLarge: { fontSize: EB_TYPE.titleLarge, lineHeight: SHELF_TYPE.titleLine + 2 },
  overview: { color: EB.secondary, fontSize: EB_TYPE.body, lineHeight: SHELF_TYPE.overviewLine, marginTop: 2 },
});
