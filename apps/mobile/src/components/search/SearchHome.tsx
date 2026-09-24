import { memo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useResumeItems, useSearchDiscover } from "@tentacle-tv/api-client";
import { MobileMediaCard } from "@/components/MobileMediaCard";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";
import { useRailCardWidth } from "./SearchSection";

interface Props {
  recent: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  onGenre: (name: string) => void;
  onOpen: (id: string) => void;
}

/**
 * La recherche avant la première lettre — ce qui sert le plus : les
 * recherches récentes (une pression les relance, la croix en retire une),
 * ce qu'on regardait (« Reprendre »), et les genres de la bibliothèque à
 * parcourir. Rien de tout cela ne demande de taper.
 */
export const SearchHome = memo(function SearchHome({ recent, onPick, onRemove, onClear, onGenre, onOpen }: Props) {
  const { t } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const width = useRailCardWidth();
  const { data: discover } = useSearchDiscover();
  const { data: resume } = useResumeItems();
  const genres = discover?.genres ?? [];

  return (
    <View>
      <View style={st.hero}>
        <Text style={st.heroTitle}>{t("emptyTitle")}</Text>
        <Text style={st.heroHint}>{t("emptyHint")}</Text>
      </View>

      {recent.length > 0 && (
        <View style={st.section}>
          <View style={st.header}>
            <Text style={st.title} accessibilityRole="header">{t("recent")}</Text>
            <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button">
              <Text style={st.action}>{t("clearRecent")}</Text>
            </Pressable>
          </View>
          {recent.map((query) => (
            <View key={query} style={st.recentRow}>
              <Pressable
                onPress={() => onPick(query)}
                accessibilityRole="button"
                style={({ pressed }) => [st.recentMain, pressed && st.pressed]}
              >
                <Feather name="clock" size={16} color={theme.colors.text.tertiary} />
                <Text style={st.recentTxt} numberOfLines={1}>{query}</Text>
                <Feather name="arrow-up-left" size={16} color={theme.colors.text.quaternary} />
              </Pressable>
              <Pressable
                onPress={() => onRemove(query)}
                accessibilityRole="button"
                accessibilityLabel={`${t("removeRecent")} : ${query}`}
                style={({ pressed }) => [st.remove, pressed && st.pressed]}
              >
                <Feather name="x" size={16} color={theme.colors.text.tertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {resume && resume.length > 0 && (
        <View style={st.section}>
          <View style={st.header}>
            <Text style={st.title} accessibilityRole="header">{t("continueWatching")}</Text>
          </View>
          <FlatList
            horizontal
            data={resume.slice(0, 10)}
            keyExtractor={(item) => item.Id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.rail}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <MobileMediaCard item={item} width={width} onPress={() => onOpen(item.Id)} />}
          />
        </View>
      )}

      {genres.length > 0 && (
        <View style={st.section}>
          <View style={st.header}>
            <Text style={st.title} accessibilityRole="header">{t("browseGenres")}</Text>
          </View>
          <View style={st.chips}>
            {genres.map((genre) => (
              <Pressable
                key={genre.name}
                onPress={() => onGenre(genre.name)}
                accessibilityRole="button"
                accessibilityLabel={`${genre.name}, ${t("titles", { count: genre.count })}`}
                style={({ pressed }) => [st.chip, pressed && st.pressed]}
              >
                <Text style={st.chipTxt}>{genre.name}</Text>
                <Text style={st.chipCount}>{genre.count}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    hero: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.lg, gap: 6 },
    heroTitle: { fontSize: 24, lineHeight: 29, fontFamily: FONT_FAMILY.extrabold, color: t.colors.text.primary, letterSpacing: -0.5 },
    heroHint: { fontSize: 14, lineHeight: 20, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
    section: { marginTop: spacing.xl },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: spacing.screenPadding,
      marginBottom: spacing.sm,
    },
    title: { fontSize: 17, fontFamily: FONT_FAMILY.bold, color: t.colors.text.primary, letterSpacing: -0.2 },
    action: { fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light },
    pressed: { opacity: 0.65 },
    recentRow: { flexDirection: "row" as const, alignItems: "center" as const, paddingLeft: spacing.screenPadding, paddingRight: 6 },
    recentMain: { flex: 1, flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: 46 },
    recentTxt: { flex: 1, fontSize: 15, fontFamily: FONT_FAMILY.medium, color: t.colors.text.primary },
    remove: { width: 44, height: 44, alignItems: "center" as const, justifyContent: "center" as const },
    rail: { paddingHorizontal: spacing.screenPadding, gap: 12 },
    chips: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, paddingHorizontal: spacing.screenPadding },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 7,
      height: 40,
      paddingHorizontal: 14,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
    },
    chipTxt: { fontSize: 14, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    chipCount: { fontSize: 12, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary },
  });
