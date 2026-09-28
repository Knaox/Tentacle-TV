import { memo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { FONT_FAMILY, spacing, useTheme } from "@/theme";

interface Props {
  /** « Lire » ou « Reprendre » — le libellé du modèle (`overlay.play.labelKey`). */
  label: string;
  /** « S2 · E5 » : l'épisode qu'une série va lancer. */
  episodeCode: string | null;
  /** Le titre de la carte, pour les lecteurs d'écran. */
  title: string;
  /** L'état de la série se charge : le glyphe tourne, le bouton reste actif (repli fiche). */
  pending: boolean;
  onPress: () => void;
}

/**
 * La lecture, en tête de feuille — la feuille remplace la carte, elle la garde
 * donc quelle que soit la variante (`cardActionEntries`) : pleine largeur, 52 de
 * haut, au dégradé de marque — la seule action en couleur, comme la lecture de
 * la fiche (`DetailPlayCta`). Aucune animation continue hors attente.
 */
export const SheetPlayButton = memo(function SheetPlayButton({ label, episodeCode, title, pending, onPress }: Props) {
  const theme = useTheme();
  const fg = theme.colors.cta.brandFg;
  const spoken = episodeCode ? `${label} ${episodeCode}` : label;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${spoken} — ${title}`}
      style={({ pressed }) => [st.wrap, { shadowColor: theme.colors.brand.violet, opacity: pressed ? 0.86 : 1 }]}
    >
      <LinearGradient
        colors={[theme.colors.brand.violet, theme.colors.brand.accent]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={st.pill}
      >
        <View style={st.icon}>
          {pending ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <Svg width={18} height={18} viewBox="0 0 24 24" style={{ marginLeft: 2 }}>
              <Path d="M8 5v14l11-7z" fill={fg} />
            </Svg>
          )}
        </View>
        <Text style={[st.label, { color: fg }]} numberOfLines={1}>{label}</Text>
        {episodeCode && <Text style={[st.code, { color: fg }]} numberOfLines={1}>{episodeCode}</Text>}
      </LinearGradient>
    </Pressable>
  );
});

const st = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 26,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  pill: {
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  icon: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 16, fontFamily: FONT_FAMILY.bold, letterSpacing: -0.1 },
  code: { fontSize: 14, fontFamily: FONT_FAMILY.medium, opacity: 0.85, fontVariant: ["tabular-nums"] },
});
