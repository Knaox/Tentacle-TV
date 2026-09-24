import { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { ExternalSearchItem, ExternalSearchResult, ExternalTone, SearchProvider } from "@tentacle-tv/shared";
import { FONT_FAMILY, RADIUS, spacing, useGrid, useTheme, useThemedStyles, type AppTheme } from "@/theme";
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
                <ExternalCard key={item.id} item={item} width={grid.itemWidth} onPress={() => onOpen(result.provider, item)} />
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
                <ExternalCard item={item} width={railWidth} onPress={() => onOpen(result.provider, item)} />
              )}
            />
          )}
        </View>
      ))}
    </>
  );
});

/** Une affiche hors bibliothèque : contour pointillé, pastille d'état du plugin, titre et année. */
function ExternalCard({ item, width, onPress }: { item: ExternalSearchItem; width: number; onPress: () => void }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.year, item.badge?.label].filter(Boolean).join(", ")}
      style={({ pressed }) => [{ width }, pressed && st.pressed]}
    >
      <View style={[st.poster, { width, height: width * 1.5 }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessible={false} />
        ) : (
          <Feather name={item.kind === "series" ? "tv" : "film"} size={26} color={theme.colors.text.quaternary} />
        )}
        {item.badge && <Badge label={item.badge.label} tone={item.badge.tone} />}
      </View>
      <Text style={st.itemTitle} numberOfLines={2}>{item.title}</Text>
      {item.year !== null && <Text style={st.itemYear}>{item.year}</Text>}
    </Pressable>
  );
}

/** La pastille d'état que le plugin pose sur un titre (« Demandé », « Bientôt »…). */
function Badge({ label, tone }: { label: string; tone: ExternalTone }) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const pair = tone === "neutral" ? null : theme.colors.statusPairs[tone === "info" ? "info" : tone];
  return (
    <View style={[st.badge, pair && { backgroundColor: pair.bg }]}>
      <Text style={[st.badgeTxt, pair && { color: pair.fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

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
    pressed: { opacity: 0.7 },
    poster: {
      borderRadius: RADIUS.md,
      overflow: "hidden" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.surface.s2,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      borderStyle: "dashed" as const,
    },
    badge: {
      position: "absolute" as const,
      left: 6,
      bottom: 6,
      maxWidth: "88%" as const,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: RADIUS.pill,
      backgroundColor: "rgba(0, 0, 0, 0.72)",
    },
    badgeTxt: { fontSize: 10.5, fontFamily: FONT_FAMILY.semibold, color: "#FFFFFF" },
    itemTitle: { marginTop: 6, fontSize: 13, lineHeight: 16, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    itemYear: { fontSize: 12, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
