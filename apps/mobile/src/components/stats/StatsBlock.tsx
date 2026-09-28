import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface StatsBlockProps {
  title: string;
  /** Une ligne sous le titre : ce que montre la carte, dans quelle unité. */
  hint?: string;
  /** À droite du titre (bouton, légende). */
  trailing?: ReactNode;
  /** Sans carte : pour les rangées d'affiches, qui débordent sur la largeur. */
  bare?: boolean;
  children: ReactNode;
}

/**
 * Une section de l'écran : le rail de marque (dégradé violet → rose) et le
 * titre, puis le contenu dans une carte opaque (`surface.s1`, filet fin) —
 * ou nu pour les rangées d'affiches. Le pendant de `StatsSection` du web.
 */
export const StatsBlock = memo(function StatsBlock({ title, hint, trailing, bare, children }: StatsBlockProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const header = (
    <View style={st.header}>
      <LinearGradient colors={[theme.colors.brand.violet, theme.colors.brand.accent]} style={st.rail} />
      <View style={st.titles}>
        <Text style={st.title} accessibilityRole="header">{title}</Text>
        {hint ? <Text style={st.hint}>{hint}</Text> : null}
      </View>
      {trailing}
    </View>
  );
  return (
    <View style={bare ? st.bare : st.card}>
      {header}
      {children}
    </View>
  );
});

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      padding: spacing.lg,
      borderRadius: RADIUS.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.surface.s1,
    },
    bare: {},
    header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: spacing.md },
    rail: { width: 3, height: 20, borderRadius: 2, marginTop: 2 },
    titles: { flex: 1, minWidth: 0 },
    title: { fontSize: 18, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.2, color: t.colors.text.primary },
    hint: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
