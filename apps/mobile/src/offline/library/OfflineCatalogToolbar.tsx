import { useMemo } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "@/components/ui";
import { SegmentedChoice } from "@/components/settings/SegmentedChoice";
import { spacing, typography, RADIUS, useResponsive, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import type { OfflineCatalogFilter } from "./useOfflineCatalog";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  filter: OfflineCatalogFilter;
  onFilter: (value: OfflineCatalogFilter) => void;
}

/**
 * La recherche en pilule de verre et le filtre Tout / Films / Séries —
 * empilés sur téléphone, sur une ligne sur tablette.
 */
export function OfflineCatalogToolbar({ search, onSearch, filter, onFilter }: Props) {
  const { t } = useTranslation(["offline", "downloads", "common"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const { isTablet } = useResponsive();
  const filterOptions = useMemo(
    () => [
      { value: "all", label: t("downloads:filterAll") },
      { value: "movies", label: t("downloads:sectionMovies") },
      { value: "series", label: t("downloads:sectionSeries") },
    ],
    [t],
  );

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
      <View style={isTablet ? st.filterTablet : undefined}>
        <SegmentedChoice
          options={filterOptions}
          value={filter}
          onChange={(value) => onFilter(value as OfflineCatalogFilter)}
          accessibilityLabel={t("downloads:filterAll")}
        />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { paddingHorizontal: spacing.screenPadding, marginTop: spacing.xxl, gap: spacing.sm },
    wrapTablet: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    searchWrap: { flex: 1 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md },
    input: { flex: 1, ...typography.body, color: t.colors.text.primary, paddingVertical: 0 },
    filterTablet: { width: 300 },
  });
