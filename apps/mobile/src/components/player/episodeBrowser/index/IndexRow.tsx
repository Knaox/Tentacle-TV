import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react-native";
import type { EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { EB, EB_TYPE, brandInk } from "../browserTokens";
import { EpisodeArtwork } from "../EpisodeArtwork";
import type { EpisodeWords } from "../useEpisodeWords";
import { WholeText } from "../WholeText";

interface Props {
  entry: EpisodeEntry;
  thumbWidth: number;
  large: boolean;
  expanded: boolean;
  artwork: ReactNode;
  words: EpisodeWords;
  onPlay: (entry: EpisodeEntry) => void;
  onToggle: (id: string) => void;
}

/**
 * Une entrée du sommaire : le NUMÉRO en grand (les épisodes sont une suite),
 * le titre, la durée — ou ce qu'il en reste —, le résumé replié sur une ligne
 * que le chevron déplie ; la vignette au bout, avec sa jauge. L'épisode en
 * cours a son numéro et son état en rose.
 */
export const IndexRow = memo(function IndexRow({ entry, thumbWidth, large, expanded, artwork, words, onPlay, onToggle }: Props) {
  const { t } = useTranslation("player");
  const numeral = entry.number !== undefined ? String(entry.number) : "·";
  const meta = [entry.current ? words.nowPlaying : null, words.time(entry)].filter(Boolean).join(" · ");
  return (
    <View style={st.row}>
      <Pressable
        onPress={() => onPlay(entry)}
        accessibilityRole="button"
        accessibilityState={{ selected: entry.current }}
        accessibilityLabel={words.spoken(entry)}
        style={({ pressed }) => [st.main, pressed && st.pressed]}
      >
        <Text style={[st.numeral, large && st.numeralLarge, entry.watched && st.numeralWatched, entry.current && { color: brandInk() }]}>{numeral}</Text>
        <View style={st.text}>
          <Text numberOfLines={2} style={[st.title, large && st.titleLarge]}>{entry.title}</Text>
          {meta ? <Text numberOfLines={1} style={[st.meta, entry.current && { color: brandInk() }]}>{meta}</Text> : null}
        </View>
        <EpisodeArtwork entry={entry} width={thumbWidth} radius={large ? 12 : 9} artwork={artwork} />
      </Pressable>
      {entry.overview ? (
        <Pressable
          onPress={() => onToggle(entry.id)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? t("episodeBrowser.hideOverview") : t("episodeBrowser.showOverview")}
          style={({ pressed }) => [st.overviewRow, large && st.overviewRowLarge, pressed && st.overviewPressed]}
        >
          {expanded ? (
            <Text style={[st.overview, large && st.overviewLarge]}>{entry.overview}</Text>
          ) : (
            <View style={st.overviewText}>
              <WholeText
                text={entry.overview}
                lines={2}
                style={[st.overview, large && st.overviewLarge]}
                fallback={<Text style={[st.overview, st.overviewHint]}>{t("episodeBrowser.showOverview")}</Text>}
              />
            </View>
          )}
          <ChevronDown size={16} color={EB.tertiary} strokeWidth={2.4} style={expanded ? st.chevronUp : undefined} />
        </Pressable>
      ) : null}
    </View>
  );
});

const NUMERAL = 46;

const st = StyleSheet.create({
  row: { paddingVertical: 12 },
  main: { flexDirection: "row", alignItems: "center", gap: 12 },
  pressed: { opacity: 0.7 },
  numeral: { width: NUMERAL, color: "rgba(255, 255, 255, 0.5)", fontSize: 30, fontWeight: "200", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  numeralLarge: { width: NUMERAL + 12, fontSize: 38 },
  numeralWatched: { color: "rgba(255, 255, 255, 0.28)" },
  text: { flex: 1, gap: 4 },
  title: { color: EB.label, fontSize: EB_TYPE.titleLarge - 1, lineHeight: 20, fontWeight: "600", letterSpacing: -0.2 },
  titleLarge: { fontSize: EB_TYPE.titleLarge + 2, lineHeight: 23 },
  meta: { color: EB.secondary, fontSize: EB_TYPE.kicker, fontWeight: "500", fontVariant: ["tabular-nums"] },
  overviewRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginLeft: NUMERAL + 12, marginTop: 8, paddingVertical: 2 },
  overviewRowLarge: { marginLeft: NUMERAL + 24 },
  overviewPressed: { opacity: 0.6 },
  overview: { flex: 1, color: "rgba(235, 235, 245, 0.5)", fontSize: EB_TYPE.body, lineHeight: 18 },
  overviewText: { flex: 1 },
  overviewHint: { color: EB.secondary },
  overviewLarge: { fontSize: EB_TYPE.body + 1, lineHeight: 20 },
  chevronUp: { transform: [{ rotate: "180deg" }] },
});
