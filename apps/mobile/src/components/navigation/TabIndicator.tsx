import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ctaGradient, useTheme, useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  width: number;
  height: number;
  /** Le style animé de `useSlidingIndicator` (opacité + translation). */
  style?: StyleProp<ViewStyle>;
}

/**
 * La pastille qui marque l'onglet actif — TOUJOURS montée, TOUJOURS avec son
 * fond : elle ne fait que glisser d'un onglet à l'autre.
 *
 * Mesuré sur Android (Fabric, RN 0.81) : une capsule à `borderRadius` dont
 * le fond n'apparaissait qu'à l'activation était rendue CARRÉE — la vue
 * n'existait pas tant qu'elle n'avait pas de fond (aplatissement), puis
 * était créée avec les seules props du dernier diff, le rayon en moins.
 * Un indicateur unique et permanent n'emprunte jamais ce chemin ;
 * `collapsable={false}` en ceinture.
 *
 * Au dégradé de marque (`ctaGradient`, celui du bouton de lecture) : l'icône
 * active s'y pose en BLANC, ≥ 4,5:1 quel que soit le contenu sous la barre.
 * C'était une pastille neutre et une icône violette, illisibles sur une
 * affiche — et c'est la FORME qui dit « ici », pas la seule couleur. Le
 * dégradé est figé : seule la translation de la pastille s'anime.
 */
export function TabIndicator({ width, height, style }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctaGradient(theme.colors.brand);
  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[st.pill, { width, height }, style]}
    >
      <LinearGradient colors={gradient.colors} start={gradient.start} end={gradient.end} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      borderRadius: 999,
      overflow: "hidden" as const,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.isDark ? "rgba(255, 255, 255, 0.22)" : "rgba(255, 255, 255, 0.4)",
    },
  });
