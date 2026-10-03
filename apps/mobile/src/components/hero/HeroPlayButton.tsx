import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ctaGradient, useTheme, useThemedStyles } from "@/theme";
import { makeHeroCtaStyles } from "./heroCtaStyles";

/**
 * Le bouton principal d'une bannière — « Lecture », « Reprendre », « Voir la
 * fiche », « Voir dans le catalogue » : le dégradé de marque, comme sur
 * l'Apple TV (il était blanc). Un seul dessin pour l'accueil, « Pour vous » et
 * le hors ligne ; libellé blanc ≥ 4,5:1 sur tout le dégradé (`ctaGradient`).
 */
export const HeroPlayButton = memo(function HeroPlayButton({
  icon,
  iconSize = 20,
  filled = false,
  label,
  accessibilityLabel,
  isTablet,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  iconSize?: number;
  /** L'icône de lecture se dessine pleine. */
  filled?: boolean;
  label: string;
  accessibilityLabel: string;
  isTablet: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const cta = useThemedStyles(makeHeroCtaStyles);
  const gradient = ctaGradient(theme.colors.brand);
  const fg = theme.colors.cta.brandFg;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={cta.playWrap}>
      {({ pressed }) => (
        <LinearGradient
          colors={gradient.colors}
          start={gradient.start}
          end={gradient.end}
          style={[cta.playBtn, isTablet && cta.playBtnTablet]}
        >
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, cta.playVeil, pressed && cta.playVeilPressed]} />
          <Feather name={icon} size={iconSize} color={fg} {...(filled ? { fill: fg } : {})} />
          <Text style={cta.playTxt}>{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
});
