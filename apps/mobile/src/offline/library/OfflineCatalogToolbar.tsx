import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, RADIUS, useResponsive, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";
import { ALL_LIBRARIES, type OfflineCatalogFilter, type OfflineCatalogLibrary } from "./useOfflineCatalog";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  filter: OfflineCatalogFilter;
  onFilter: (value: OfflineCatalogFilter) => void;
  /** Les bibliothèques d'origine des titres de l'appareil — une puce chacune. */
  libraries: OfflineCatalogLibrary[];
}

/**
 * La recherche en pilule de verre et le filtre par BIBLIOTHÈQUE Jellyfin
 * d'origine (Tout, Films, Séries, Animés…) en puces — les mêmes que celles de
 * la bibliothèque en ligne (`GenreFilter`), avec le compte de chacune. Une
 * seule bibliothèque sur l'appareil : rien à filtrer, les puces s'effacent.
 * Empilés sur téléphone, sur une ligne sur tablette.
 */
export function OfflineCatalogToolbar({ search, onSearch, filter, onFilter, libraries }: Props) {
  const { t } = useTranslation(["offline", "downloads", "common"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { isTablet } = useResponsive();
  const options = useMemo<Array<{ value: OfflineCatalogFilter; label: string; count: number | null }>>(
    () => [
      { value: ALL_LIBRARIES, label: t("downloads:filterAll"), count: null },
      ...libraries.map((library) => ({ value: library.id, label: library.label, count: library.count })),
    ],
    [t, libraries],
  );
  const showChips = libraries.length >= 2;

  return (
    <View style={[st.wrap, isTablet && st.wrapTablet]}>
      <View style={st.searchWrap}>
        <GlassSurface tier="subtle" tint="regular" radius={RADIUS.pill}>
          <View style={st.searchRow}>
            <Feather name="search" size={16} color={theme.colors.text.tertiary} />
            <TextInput
              value={search}
              onChangeText={onSearch}
              placeholder={t("offline:searchPlaceholder")}
              placeholderTextColor={theme.colors.text.quaternary}
              style={st.input}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel={t("offline:searchPlaceholder")}
            />
            {search.length > 0 && (
              <Pressable onPress={() => onSearch("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common:clear")}>
                <Feather name="x" size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            )}
          </View>
        </GlassSurface>
      </View>
      {showChips && (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.chipsScroll}
        contentContainerStyle={st.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t("downloads:filterAll")}
      >
        {options.map((option) => {
          const active = option.value === filter;
          return (
            <Pressable
              key={option.value}
              onPress={() => onFilter(option.value)}
              hitSlop={6}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [st.chip, active && st.chipActive, pressed && st.chipPressed]}
            >
              <Text style={[st.chipText, active && st.chipTextActive]}>{option.label}</Text>
              {option.count !== null && (
                <Text style={[st.chipCount, active && st.chipCountActive]}>{option.count}</Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.xxl, gap: spacing.md },
    wrapTablet: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    searchWrap: { flex: 1 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md },
    input: { flex: 1, ...typography.body, color: t.colors.text.primary, paddingVertical: 0 },
    chipsScroll: { flexGrow: 0, flexShrink: 1 },
    chips: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      height: 34,
      paddingHorizontal: 12,
      borderRadius: 17,
      backgroundColor: t.colors.surface.s2,
      borderWidth: 1,
      borderColor: t.colors.brand.soft,
    },
    chipActive: { backgroundColor: t.colors.brand.soft, borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow) },
    chipPressed: { opacity: 0.8 },
    chipText: { ...typography.caption, color: t.colors.text.secondary, lineHeight: 16 },
    chipTextActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
    chipCount: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.quaternary, lineHeight: 14 },
    chipCountActive: { color: t.colors.brand.light },
  });
