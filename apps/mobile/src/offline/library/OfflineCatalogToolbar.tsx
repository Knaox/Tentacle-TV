import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { GlassSurface } from "@/components/ui";
import { spacing, typography, RADIUS, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { OfflineLibraryRail } from "./OfflineLibraryRail";
import type { OfflineCatalogFilter, OfflineCatalogLibrary } from "./useOfflineCatalog";

interface Props {
  search: string;
  onSearch: (value: string) => void;
  filter: OfflineCatalogFilter;
  onFilter: (value: OfflineCatalogFilter) => void;
  /** Les bibliothèques d'origine des titres de l'appareil — une tuile chacune. */
  libraries: OfflineCatalogLibrary[];
  /** Titres de l'appareil (tuile « Tout »), le compte du résumé. */
  total: number;
}

/**
 * La recherche en pilule de verre, puis le filtre par vraie bibliothèque
 * Jellyfin en tuiles (`OfflineLibraryRail`). Une seule bibliothèque sur
 * l'appareil : rien à filtrer, la rangée s'efface.
 */
export function OfflineCatalogToolbar({ search, onSearch, filter, onFilter, libraries, total }: Props) {
  const { t } = useTranslation(["offline", "common"]);
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);

  return (
    <View style={st.wrap}>
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
      {libraries.length >= 2 && (
        <OfflineLibraryRail libraries={libraries} total={total} filter={filter} onFilter={onFilter} />
      )}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { marginTop: spacing.xxl, gap: spacing.md },
    searchWrap: { paddingHorizontal: spacing.screenPadding },
    searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md },
    input: { flex: 1, ...typography.body, color: t.colors.text.primary, paddingVertical: 0 },
  });
