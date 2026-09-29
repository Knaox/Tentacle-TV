import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONT_FAMILY, RADIUS, spacing, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface StatsBlockProps {
  title: string;
  /** Une ligne sous le titre : ce que montre la section, dans quelle unité. */
  hint?: string;
  /** À droite du titre (bouton, légende). */
  trailing?: ReactNode;
  /** Sans carte : pour les rangées d'affiches, qui débordent sur la largeur. */
  bare?: boolean;
  children: ReactNode;
}

/**
 * Une section de l'écran, en deux grammaires — celles du web
 * (`StatsSection`) : une RANGÉE d'affiches (`bare`) prend le rail de marque
 * et le titre fort des rangées de l'accueil ; une CARTE de chiffres prend un
 * titre discret, sans ornement, dans une surface opaque (`surface.s1`, filet
 * fin) : ce sont les données qui parlent.
 */
export const StatsBlock = memo(function StatsBlock({ title, hint, trailing, bare, children }: StatsBlockProps) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  if (bare) {
    return (
      <View>
        <View style={st.header}>
          <LinearGradient colors={[theme.colors.brand.violet, theme.colors.brand.accent]} style={st.rail} />
          <View style={st.titles}>
            <Text style={st.rowTitle} accessibilityRole="header">{title}</Text>
            {hint ? <Text style={st.hint}>{hint}</Text> : null}
          </View>
          {trailing}
        </View>
        {children}
      </View>
    );
  }
  return (
    <View style={st.card}>
      <View style={st.header}>
        <View style={st.titles}>
          <Text style={st.cardTitle} accessibilityRole="header">{title}</Text>
          {hint ? <Text style={st.hint}>{hint}</Text> : null}
        </View>
        {trailing}
      </View>
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
    header: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: spacing.md },
    rail: { width: 3, height: 20, borderRadius: 2, marginTop: 2 },
    titles: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 18, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.2, color: t.colors.text.primary },
    cardTitle: { fontSize: 15, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    hint: { marginTop: 2, fontSize: 13, lineHeight: 18, fontFamily: FONT_FAMILY.regular, color: t.colors.text.tertiary },
  });
