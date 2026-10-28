/**
 * Octave mobile — les puces Tout · Titres · Albums · Artistes · Playlists d'une
 * recherche validée (rangée qui défile si l'écran est étroit). La puce choisie
 * prend le dégradé d'Octave ; une puce remplace l'adresse, sans entrée
 * d'historique.
 */

import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import type { SearchFilter } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";

const FILTERS: { value: SearchFilter; key: string }[] = [
  { value: "all", key: "search.filterAll" },
  { value: "tracks", key: "search.tracks" },
  { value: "albums", key: "search.albums" },
  { value: "artists", key: "search.artists" },
  { value: "playlists", key: "search.playlists" },
];

export const FilterChips = memo(function FilterChips({ value, onChange, gutter }: { value: SearchFilter; onChange: (f: SearchFilter) => void; gutter: number }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }} accessibilityRole="tablist" accessibilityLabel={t("search.filters")}>
      {FILTERS.map((f) => {
        const on = f.value === value;
        return (
          <Pressable
            key={f.value}
            onPress={() => {
              if (on) return;
              haptic("select");
              onChange(f.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.chip, { backgroundColor: on ? theme.colors.cta.brandBg : theme.colors.fill.subtle, borderColor: on ? "transparent" : theme.colors.border.subtle }]}
          >
            <Text style={[typography.bodyBold, { fontSize: 14, color: on ? theme.colors.cta.brandFg : theme.colors.text.primary }]}>{t(f.key)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
});
