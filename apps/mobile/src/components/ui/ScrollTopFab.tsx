import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { motion, useTheme, useThemedStyles, type AppTheme } from "@/theme";

const FADE_MS = 200;

/**
 * Le bouton rond « revenir en haut », posé en bas à droite d'une longue
 * grille. Son apparition est pilotée sur le fil UI (`shown`, 0/1) : aucun
 * rendu React par image de défilement. Caché, il ne capte rien (`active`).
 */
export function ScrollTopFab({ shown, active, bottom, onPress }: {
  /** 0 → 1, écrit par le gestionnaire de défilement. */
  shown: SharedValue<number>;
  /** Visible pour le toucher et les lecteurs d'écran. */
  active: boolean;
  /** Distance au bas de l'écran (barre d'onglets et indicateur d'accueil compris). */
  bottom: number;
  onPress: () => void;
}) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const duration = motion.respectReducedMotion(FADE_MS);
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(shown.value, { duration }),
    transform: [{ translateY: withTiming((1 - shown.value) * 12, { duration }) }],
  }), [duration]);

  return (
    <Animated.View
      pointerEvents={active ? "box-none" : "none"}
      style={[st.wrap, { bottom }, style]}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("scrollToTop")}
        style={({ pressed }) => [st.button, pressed && st.pressed]}
      >
        <Feather name="arrow-up" size={22} color={theme.colors.text.primary} />
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: { position: "absolute" as const, right: 16 },
    button: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      backgroundColor: t.colors.surface.s2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.strong,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: t.isDark ? 0.45 : 0.18,
      shadowRadius: 16,
      elevation: 10,
    },
    pressed: { transform: [{ scale: 0.94 }] },
  });
