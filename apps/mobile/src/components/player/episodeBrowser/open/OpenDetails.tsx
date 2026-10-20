import { memo, useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react-native";
import type { EpisodeEntry } from "../../../../player/episodes/episodeBrowserModel";
import { EB, EB_HIT, EB_TYPE, brandInk } from "../browserTokens";
import type { EpisodeWords } from "../useEpisodeWords";

interface Props {
  entry: EpisodeEntry | undefined;
  height: number;
  overviewLines: 1 | 2;
  large: boolean;
  words: EpisodeWords;
  onPlay: (entry: EpisodeEntry) => void;
}

/**
 * Les détails de la carte ouverte, dans leur place RÉSERVÉE (rien ne se remet
 * en page) : le surtitre, le titre, le résumé en phrases, et « Lire » — ou
 * « Reprendre » d'un épisode entamé — en pilule blanche. Un fondu bref à
 * chaque carte qui s'ouvre.
 */
export const OpenDetails = memo(function OpenDetails({ entry, height, overviewLines, large, words, onPlay }: Props) {
  const { t } = useTranslation(["player", "common"]);
  const fade = useRef(new Animated.Value(1)).current;
  const id = entry?.id;
  useEffect(() => {
    fade.setValue(0.25);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [id, fade]);
  if (!entry) return <View style={{ height }} />;
  const resume = entry.progress !== null;
  return (
    <Animated.View style={[st.root, { height, opacity: fade }]}>
      <View style={st.text}>
        <Text numberOfLines={1} style={[st.kicker, large && st.kickerLarge, entry.current && { color: brandInk() }]}>
          {entry.current ? `${words.nowPlaying} · ${words.kicker(entry)}` : words.kicker(entry)}
        </Text>
        <Text numberOfLines={1} style={[st.title, large && st.titleLarge]}>{entry.title}</Text>
        {entry.overview ? <Text numberOfLines={overviewLines} style={[st.overview, large && st.overviewLarge]}>{entry.overview}</Text> : null}
      </View>
      <Pressable
        onPress={() => onPlay(entry)}
        accessibilityRole="button"
        accessibilityLabel={`${resume ? t("common:resume") : t("player:play")}, ${entry.title}`}
        hitSlop={{ top: 8, bottom: 8 }}
        style={({ pressed }) => [st.play, large && st.playLarge, pressed && st.playPressed]}
      >
        <Play size={large ? 15 : 13} color="#000000" fill="#000000" strokeWidth={0} />
        <Text style={[st.playText, large && st.playTextLarge]}>{resume ? t("common:resume") : t("player:play")}</Text>
      </Pressable>
    </Animated.View>
  );
});

const st = StyleSheet.create({
  root: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  text: { flex: 1, gap: 4 },
  kicker: { color: EB.secondary, fontSize: EB_TYPE.kicker, fontWeight: "600", fontVariant: ["tabular-nums"] },
  kickerLarge: { fontSize: EB_TYPE.kicker + 1 },
  title: { color: EB.label, fontSize: EB_TYPE.titleLarge, lineHeight: 21, fontWeight: "700", letterSpacing: -0.25 },
  titleLarge: { fontSize: EB_TYPE.titleLarge + 3, lineHeight: 24 },
  overview: { color: EB.secondary, fontSize: EB_TYPE.body, lineHeight: 17, marginTop: 2 },
  overviewLarge: { fontSize: EB_TYPE.body + 1, lineHeight: 19 },
  play: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, minWidth: EB_HIT + 40, paddingHorizontal: 16, borderRadius: 18, backgroundColor: "rgba(255, 255, 255, 0.95)", marginTop: 4, justifyContent: "center" },
  playLarge: { height: 42, borderRadius: 21, paddingHorizontal: 20 },
  playPressed: { backgroundColor: "rgba(255, 255, 255, 0.75)" },
  playText: { color: "#000000", fontSize: 15, fontWeight: "700" },
  playTextLarge: { fontSize: 17 },
});
