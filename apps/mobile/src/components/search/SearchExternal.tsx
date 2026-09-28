import { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ExternalSearchItem, ExternalSearchResult, SearchProvider } from "@tentacle-tv/shared";
import { FONT_FAMILY, spacing, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { ExternalResultCard } from "./ExternalResultCard";
import { useRailCardWidth } from "./SearchSection";

interface Props {
  results: ExternalSearchResult[];
  onOpen: (provider: SearchProvider, item: ExternalSearchItem) => void;
  onSeeAll: (provider: SearchProvider, href: string) => void;
  /** `rail` dans les résultats ; `grid` sous une filmographie, dans la suite de la grille de la bibliothèque. */
  layout?: "rail" | "grid";
}

/**
 * Ce que les extensions trouvent HORS de la bibliothèque, une section par
 * plugin, sous le nom qu'il a choisi (« Pas encore sur le serveur ») et
 * « via Vigie » : on sait d'où vient chaque titre, et qu'il n'est pas encore
 * là. Chaque carte ouvre la page du plugin qui le montre.
 */
export const ExternalSections = memo(function ExternalSections({ results, onOpen, onSeeAll, layout = "rail" }: Props) {
  const { t } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const railWidth = useRailCardWidth();
  const grid = useGrid({ phoneColumns: 3, gutter: 12 });

  return (
    <>
      {results.map((result) => (
        <View key={result.provider.pluginId} style={st.section}>
          <View style={st.header}>
            <View style={st.headText}>
              <Text style={st.title} accessibilityRole="header">{result.provider.label}</Text>
              <Text style={st.via}>{t("externalBy", { name: result.provider.source })}</Text>
            </View>
            {result.moreHref && (
              <Pressable onPress={() => onSeeAll(result.provider, result.moreHref as string)} hitSlop={10} accessibilityRole="button" style={st.more}>
                <Text style={st.moreTxt} numberOfLines={1}>{t("externalSeeAll", { name: result.provider.source })}</Text>
                <Feather name="chevron-right" size={15} color={theme.colors.brand.light} />
              </Pressable>
            )}
          </View>
          {layout === "grid" ? (
            <View style={[st.grid, { paddingHorizontal: grid.padding, gap: grid.gutter }]}>
              {result.items.map((item) => (
                <ExternalResultCard key={item.id} item={item} width={grid.itemWidth} onPress={() => onOpen(result.provider, item)} />
              ))}
            </View>
          ) : (
            <FlatList
              horizontal
              data={result.items}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.rail}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <ExternalResultCard item={item} width={railWidth} onPress={() => onOpen(result.provider, item)} />
              )}
            />
          )}
        </View>
      ))}
    </>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    section: { marginTop: spacing.lg },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      gap: spacing.sm,
      paddingHorizontal: spacing.screenPadding,
      marginBottom: spacing.sm,
    },
    headText: { flexShrink: 1 },
    title: { fontSize: 17, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2 },
    via: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginTop: 1 },
    more: { flexDirection: "row" as const, alignItems: "center" as const, gap: 2, minHeight: 32, maxWidth: 170 },
    moreTxt: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    rail: { paddingHorizontal: spacing.screenPadding, gap: 12 },
    grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, rowGap: spacing.md },
  });
