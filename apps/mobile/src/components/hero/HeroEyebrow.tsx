import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FONT_FAMILY, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  label: string;
  /** Méta sobre à droite du libellé (qualité, langues…). */
  hint?: string;
}

/**
 * Sur-titre d'une bannière : rail de marque lumineux + libellé en capitales,
 * le `HeroEyebrow` du web. Posé sur l'affiche, donc en jetons `onMedia.*`
 * (blanc constant) dans les deux schémas — c'est le rail qui porte la marque,
 * jamais le texte.
 */
export function HeroEyebrow({ label, hint }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  return (
    <View style={st.row}>
      <View style={st.rail} accessibilityElementsHidden importantForAccessibility="no">
        <LinearGradient
          colors={[theme.colors.brand.light, theme.colors.brand.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <Text style={st.label} numberOfLines={1}>{label}</Text>
      {hint ? <Text style={st.hint} numberOfLines={1}>{hint}</Text> : null}
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row" as const, alignItems: "center" as const, gap: 10 },
  rail: {
    width: 3,
    height: 16,
    borderRadius: 2,
    overflow: "hidden" as const,
    shadowColor: t.colors.brand.violet,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.bold,
    color: t.colors.onMedia.primary,
    letterSpacing: 2.4,
    textTransform: "uppercase" as const,
    textShadowColor: t.colors.onMedia.shadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  hint: {
    fontSize: 11,
    fontFamily: FONT_FAMILY.semibold,
    color: t.colors.onMedia.secondary,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
});
