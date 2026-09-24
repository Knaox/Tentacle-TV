import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { FONT_FAMILY, spacing, typography, useTheme, useThemedStyles, type AppTheme } from "@/theme";

/**
 * Une pastille de filtre au doigt, pour les feuilles de filtres : 40 pt de
 * haut (les rangées de 28 à 30 pt des barres étaient sous la cible), et l'état
 * choisi se lit sans la couleur — une coche le précède.
 */
export function FilterChip({ label, active, onPress, accessibilityLabel }: {
  label: string;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [st.chip, active && st.chipActive, pressed && st.pressed]}
    >
      {active && <Feather name="check" size={14} color={theme.colors.brand.light} />}
      <Text style={[st.text, active && st.textActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Une section de feuille de filtres : son titre, puis ses pastilles en retour à la ligne. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.section}>
      <Text style={st.title} accessibilityRole="header">{title}</Text>
      <View style={st.wrap}>{children}</View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    chip: {
      minHeight: 40,
      paddingHorizontal: 14,
      borderRadius: 999,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 6,
      backgroundColor: t.colors.fill.subtle,
      borderWidth: 1,
      borderColor: t.colors.border.subtle,
    },
    chipActive: { backgroundColor: t.colors.brand.soft, borderColor: t.colors.brand.glow },
    pressed: { opacity: 0.8 },
    text: { ...typography.caption, fontSize: 14, fontFamily: FONT_FAMILY.medium, color: t.colors.text.secondary },
    textActive: { color: t.colors.brand.light, fontFamily: FONT_FAMILY.semibold },
    section: { gap: 10 },
    title: { ...typography.badge, fontFamily: FONT_FAMILY.bold, color: t.colors.text.tertiary, letterSpacing: 0.8, textTransform: "uppercase" as const },
    wrap: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: spacing.sm },
  });
