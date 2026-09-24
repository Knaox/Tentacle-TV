import { Pressable, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme";
import { useChromeVeil } from "./scrollChrome";

/**
 * Le voile posé sur un élément du chrome (en-tête, rail) pendant qu'une page
 * d'extension affiche une surface modale : il assombrit, et un toucher ferme
 * la surface du dessus — comme un toucher hors d'une feuille. Hors voile, il
 * ne capte rien. À poser en DERNIER enfant de l'élément voilé.
 */
export function ChromeVeilLayer() {
  const veil = useChromeVeil();
  const theme = useTheme();
  const { t } = useTranslation("common");
  const fallback = useSharedValue(0);
  const progress = veil?.progress ?? fallback;
  const fade = useAnimatedStyle(() => ({ opacity: progress.value }));
  if (!veil) return null;
  return (
    <Animated.View
      pointerEvents={veil.active ? "auto" : "none"}
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.glass.backdrop }, fade]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={veil.dismiss}
        accessibilityRole="button"
        accessibilityLabel={t("close")}
        accessibilityElementsHidden={!veil.active}
        importantForAccessibility={veil.active ? "yes" : "no-hide-descendants"}
      />
    </Animated.View>
  );
}
