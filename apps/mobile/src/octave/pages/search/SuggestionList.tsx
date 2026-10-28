/**
 * Octave mobile — les SUGGESTIONS pendant la frappe (`buildSuggestions` via
 * `useOctaveSuggestions`, la règle du bureau : récentes, bibliothèque,
 * extension ; une suggestion n'est qu'un texte à chercher). Dans la page, sous
 * la barre — jamais une liste flottante qui recouvre. Une récente se retire.
 */

import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { ArrowUpLeft, Clock, Disc3, Mic2, Music2, X } from "lucide-react-native";
import type { OctaveSuggestion } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";

const ICONS = { recent: Clock, artist: Mic2, track: Music2, album: Disc3 } as const;

interface SuggestionListProps {
  suggestions: readonly OctaveSuggestion[];
  onPick: (text: string) => void;
  onFill: (text: string) => void;
  onForget: (text: string) => void;
  gutter: number;
}

export const SuggestionList = memo(function SuggestionList({ suggestions, onPick, onFill, onForget, gutter }: SuggestionListProps) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(120)} accessibilityLabel={t("search.suggestions")}>
      {suggestions.map((s) => {
        const Icon = ICONS[s.kind];
        return (
          <Pressable
            key={s.id}
            onPress={() => onPick(s.text)}
            accessibilityRole="button"
            accessibilityLabel={s.subtitle ? `${s.title}, ${s.subtitle}` : s.title}
            style={({ pressed }) => [styles.row, { paddingHorizontal: gutter, backgroundColor: pressed ? theme.colors.fill.subtle : "transparent" }]}
          >
            <Icon size={18} color={theme.colors.text.tertiary} />
            <View style={styles.text}>
              <Text numberOfLines={1} style={[typography.body, { color: theme.colors.text.primary }]}>
                {s.title}
              </Text>
              {s.subtitle ? (
                <Text numberOfLines={1} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
                  {s.subtitle}
                </Text>
              ) : null}
            </View>
            {s.kind === "recent" ? (
              <Pressable onPress={() => onForget(s.text)} hitSlop={8} style={styles.side} accessibilityRole="button" accessibilityLabel={t("search.forget", { query: s.text })}>
                <X size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            ) : (
              <Pressable onPress={() => onFill(s.text)} hitSlop={8} style={styles.side} accessibilityRole="button" accessibilityLabel={s.text}>
                <ArrowUpLeft size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            )}
          </Pressable>
        );
      })}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 14 },
  text: { flex: 1, minWidth: 0 },
  side: { width: 40, height: 40, alignItems: "center", justifyContent: "center", marginRight: -8 },
});
