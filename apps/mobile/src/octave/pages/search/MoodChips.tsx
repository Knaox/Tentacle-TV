/**
 * Octave mobile — les puces d'ambiance de la recherche vide : une puce par
 * ambiance, sa couleur en pastille, qui ouvre sa playlist ; elles passent à la
 * ligne. Sans extension qui les sert : rien.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useMusicMoods } from "@tentacle-tv/api-client";
import { typography, useTheme } from "@/theme";
import { useOctaveNav } from "../env/nav";
import { useOctavePagesProvider } from "../env/pagesEnv";
import { SectionTitle } from "../ui/Shelf";

export const MoodChips = memo(function MoodChips({ gutter }: { gutter: number }) {
  const { t, i18n } = useTranslation("music");
  const theme = useTheme();
  const nav = useOctaveNav();
  const { moods } = useMusicMoods(useOctavePagesProvider(), i18n.language);
  if (moods.length === 0) return null;
  return (
    <View>
      <SectionTitle title={t("moods.searchTitle")} />
      <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
        {moods.map((mood) => (
          <Pressable
            key={mood.id}
            onPress={() => nav.mood(mood.id)}
            accessibilityRole="button"
            accessibilityLabel={t("moods.open", { name: mood.name })}
            style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? theme.colors.fill.soft : theme.colors.fill.subtle, borderColor: theme.colors.border.subtle }]}
          >
            <View style={[styles.dot, { backgroundColor: mood.color }]} />
            <Text style={[typography.bodyBold, { color: theme.colors.text.primary, fontSize: 14 }]}>{mood.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
