import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { EB, EB_TYPE } from "../browserTokens";
import { EpisodeArtwork } from "../EpisodeArtwork";
import { WholeText } from "../WholeText";
import type { EpisodeWords } from "../useEpisodeWords";

/** Hauteur FIXE d'une ligne : la liste s'ouvre sur l'épisode en cours sans rien mesurer. */
export const PANEL_ROW_HEIGHT = { phone: 96, tablet: 122 } as const;

interface Props {
  entry: EpisodeEntry;
  thumbWidth: number;
  overviewLines: 0 | 1 | 2;
  large: boolean;
  artwork: ReactNode;
  words: EpisodeWords;
  onPlay: (entry: EpisodeEntry) => void;
}

/**
 * Une ligne du panneau, la grande ligne d'épisode de la TV à l'échelle du
 * doigt : la vignette (jauge, « vu »), « Épisode 6 · 12 min », le titre, le
 * début du résumé en phrases entières. L'épisode en cours : la ligne éclairée
 * et « En cours » dans l'image.
 */
export const PanelRow = memo(function PanelRow({ entry, thumbWidth, overviewLines, large, artwork, words, onPlay }: Props) {
  const height = large ? PANEL_ROW_HEIGHT.tablet : PANEL_ROW_HEIGHT.phone;
  return (
    <Pressable
      onPress={() => onPlay(entry)}
      accessibilityRole="button"
      accessibilityState={{ selected: entry.current }}
      accessibilityLabel={words.spoken(entry)}
      style={({ pressed }) => [st.row, { height }, entry.current && st.current, pressed && st.pressed]}
    >
      <EpisodeArtwork entry={entry} width={thumbWidth} radius={large ? 12 : 10} artwork={artwork} badge compactBadge={!large} />
      <View style={st.text}>
        <Text numberOfLines={1} style={[st.kicker, large && st.kickerLarge]}>{words.kicker(entry)}</Text>
        <Text numberOfLines={2} style={[st.title, large && st.titleLarge]}>{entry.title}</Text>
        {overviewLines > 0 && entry.overview ? (
          <WholeText text={entry.overview} lines={overviewLines} style={[st.overview, large && st.overviewLarge]} />
        ) : null}
      </View>
    </Pressable>
  );
});

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 10, borderRadius: 16 },
  current: { backgroundColor: EB.selected },
  pressed: { backgroundColor: EB.pressed },
  text: { flex: 1, gap: 3, justifyContent: "center" },
  kicker: { color: EB.secondary, fontSize: EB_TYPE.kicker - 0.5, fontWeight: "600", fontVariant: ["tabular-nums"], flexShrink: 1 },
  kickerLarge: { fontSize: EB_TYPE.kicker + 1 },
  title: { color: EB.label, fontSize: EB_TYPE.title, lineHeight: 19, fontWeight: "600", letterSpacing: -0.15 },
  titleLarge: { fontSize: EB_TYPE.titleLarge, lineHeight: 22 },
  overview: { color: "rgba(235, 235, 245, 0.52)", fontSize: EB_TYPE.body, lineHeight: 17 },
  overviewLarge: { fontSize: EB_TYPE.body + 1, lineHeight: 19, color: EB.secondary },
});
