import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Des requêtes complètes à reprendre d'une pression — la bonne orthographe,
 * puis les titres qui commencent par ce qui est tapé. `wrap` dans le panneau
 * d'une barre locale, `rail` (une ligne qui défile) en tête des résultats.
 */
export const QuerySuggestions = memo(function QuerySuggestions({ queries, onPick, layout }: {
  queries: readonly string[];
  onPick: (query: string) => void;
  layout: "wrap" | "rail";
}) {
  const { t } = useTranslation("search");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  if (queries.length === 0) return null;

  const chips = queries.map((value) => (
    <Pressable
      key={value}
      onPress={() => onPick(value)}
      accessibilityRole="button"
      accessibilityLabel={`${t("suggestions")} : ${value}`}
      style={({ pressed }) => [st.chip, pressed && st.pressed]}
    >
      <Feather name="search" size={13} color={theme.colors.brand.light} />
      <Text style={st.text} numberOfLines={1}>{value}</Text>
    </Pressable>
  ));

  return (
    <View>
      <Text style={[st.heading, layout === "rail" && st.headingRail]}>{t("suggestions")}</Text>
      {layout === "wrap" ? (
        <View style={st.wrap}>{chips}</View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.rail}
        >
          {chips}
        </ScrollView>
      )}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    heading: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: 6,
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: "uppercase" as const,
      fontFamily: FONT_FAMILY.semibold,
      color: t.colors.text.tertiary,
    },
    headingRail: { paddingHorizontal: spacing.screenPadding, paddingTop: spacing.md },
    wrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, paddingHorizontal: spacing.md, paddingBottom: 4 },
    rail: { gap: 6, paddingHorizontal: spacing.screenPadding },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      height: 34,
      maxWidth: 280,
      paddingHorizontal: 12,
      borderRadius: RADIUS.pill,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    pressed: { backgroundColor: t.colors.fill.soft },
    text: { flexShrink: 1, fontSize: 13, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  });
