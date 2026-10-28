/**
 * Octave mobile — la carte d'une AMBIANCE (4:3) : sa couleur en dégradé
 * (assombrie là où le nom se pose, `shade`, la règle du bureau), son image
 * dessous si l'extension en donne une, le nom en haut, Lecture en bas à droite.
 * Toucher : sa page ; Lecture : sa playlist d'un geste.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { Play } from "lucide-react-native";
import { shade } from "@tentacle-tv/shared/octave";
import type { ExternalMusicMood } from "@tentacle-tv/shared/music";
import { PressableCard } from "@/components/ui";
import { typography } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { useArtworkResolver } from "../env/pagesEnv";
import { useMoodPlay } from "../env/useMoodPlay";
import { artworkCacheKey } from "../ui/artworkSource";

export const MoodCard = memo(function MoodCard({ mood, width }: { mood: ExternalMusicMood; width: number }) {
  const { t } = useTranslation("music");
  const nav = useOctaveNav();
  const play = useMoodPlay();
  const resolve = useArtworkResolver();
  const src = resolve(mood.artworkUrl);
  return (
    <PressableCard onPress={() => nav.mood(mood.id)} style={{ width }} accessibilityRole="button" accessibilityLabel={t("moods.open", { name: mood.name })}>
      <View style={[styles.card, { width, height: Math.round((width * 3) / 4) }]}>
        <LinearGradient colors={[shade(mood.color, 0.4), mood.color]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {src ? (
          <>
            <Image source={{ uri: src, cacheKey: artworkCacheKey(src) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} cachePolicy="memory-disk" />
            <LinearGradient colors={[shade(mood.color, 0.55), "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 0.8 }} style={StyleSheet.absoluteFill} />
          </>
        ) : null}
        <Text numberOfLines={2} style={[typography.subtitle, styles.name]}>
          {mood.name}
        </Text>
        <Pressable onPress={() => void play(mood.id)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("moods.play", { name: mood.name })} style={styles.play}>
          <Play size={16} color="#0e0b13" fill="#0e0b13" />
        </Pressable>
      </View>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 12, overflow: "hidden", padding: 12 },
  name: { color: "#fff", fontSize: 17 },
  play: { position: "absolute", right: 10, bottom: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.92)", alignItems: "center", justifyContent: "center" },
});
