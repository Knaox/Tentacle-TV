import { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * L'en-tête d'une section de Mes favoris : filet de marque (dégradé violet →
 * rose), titre 17 gras, compte en pastille, chevron qui replie. 44 de haut,
 * toute la ligne se touche ; l'état se lit aussi au lecteur d'écran
 * (`expanded`). Même dessin que le miroir web.
 */
export const FavoritesSectionHeader = memo(function FavoritesSectionHeader({
  title, count, collapsed, onToggle, first,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  first: boolean;
}) {
  const { colors } = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityLabel={`${title}, ${count}`}
      onPress={onToggle}
      style={({ pressed }) => [st.row, !first && st.spaced, pressed && { opacity: 0.8 }]}
    >
      <LinearGradient colors={[colors.brand.light, colors.brand.accent]} style={st.bar} />
      <Text style={st.title} numberOfLines={1}>{title}</Text>
      <View style={st.badge}>
        <Text style={st.badgeText}>{count}</Text>
      </View>
      <View style={st.spacer} />
      <Feather name={collapsed ? "chevron-right" : "chevron-down"} size={18} color={colors.text.tertiary} />
    </Pressable>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: spacing.screenPadding,
      marginBottom: 4,
    },
    spaced: { marginTop: spacing.md },
    bar: { width: 3, height: 18, borderRadius: 2 },
    title: { flexShrink: 1, fontSize: 17, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.3, color: t.colors.text.primary },
    badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: t.colors.brand.soft },
    badgeText: { fontSize: 12, fontFamily: FONT_FAMILY.semibold, color: t.colors.brand.light, fontVariant: ["tabular-nums"] },
    spacer: { flex: 1 },
  });
