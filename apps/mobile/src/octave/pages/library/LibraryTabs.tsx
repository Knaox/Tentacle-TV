/**
 * Octave mobile — les onglets de la bibliothèque, un segment à pastille qui
 * GLISSE d'un onglet à l'autre (ressort, transformation seule), et le tri des
 * albums en puces. Cibles de 44 pt.
 */

import { memo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { LIBRARY_ALBUM_SORTS, LIBRARY_TABS, type LibraryAlbumSort, type LibraryTab } from "@tentacle-tv/shared/octave";
import { typography, useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";

export const LibraryTabs = memo(function LibraryTabs({ value, onChange }: { value: LibraryTab; onChange: (tab: LibraryTab) => void }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const segment = width / LIBRARY_TABS.length;
  const index = LIBRARY_TABS.indexOf(value);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(index * segment, { damping: 20, stiffness: 220 }) }] }), [index, segment]);
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: theme.colors.fill.subtle }]}
      accessibilityRole="tablist"
    >
      {width > 0 ? <Animated.View style={[styles.pill, { width: segment - 4, backgroundColor: theme.colors.surface.s3 }, pill]} /> : null}
      {LIBRARY_TABS.map((tab) => {
        const on = tab === value;
        return (
          <Pressable
            key={tab}
            onPress={() => {
              if (on) return;
              haptic("select");
              onChange(tab);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.tab}
          >
            <Text style={[typography.bodyBold, { fontSize: 14, color: on ? theme.colors.text.primary : theme.colors.text.tertiary }]}>{t(`library.${tab}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

export const SortChips = memo(function SortChips({ value, onChange }: { value: LibraryAlbumSort; onChange: (s: LibraryAlbumSort) => void }) {
  const { t } = useTranslation("music");
  const theme = useTheme();
  return (
    <View style={styles.sorts} accessibilityLabel={t("library.sort")}>
      {LIBRARY_ALBUM_SORTS.map((s) => {
        const on = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.sort, { backgroundColor: on ? theme.colors.brand.soft : "transparent", borderColor: on ? theme.colors.brand.accent : theme.colors.border.subtle }]}
          >
            <Text style={[typography.caption, { fontWeight: "600", color: on ? theme.colors.text.primary : theme.colors.text.secondary }]}>{t(s.key)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  track: { flexDirection: "row", borderRadius: 12, padding: 2, minHeight: 44 },
  pill: { position: "absolute", top: 2, bottom: 2, left: 2, borderRadius: 10 },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 40 },
  sorts: { flexDirection: "row", gap: 8 },
  sort: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
});
