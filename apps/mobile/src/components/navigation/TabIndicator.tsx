import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useThemedStyles, type AppTheme } from "@/theme";

interface Props {
  width: number;
  height: number;
  /** Le style animé de `useSlidingIndicator` (opacité + translation). */
  style?: StyleProp<ViewStyle>;
}

/**
 * La pilule qui marque l'onglet actif — TOUJOURS montée, TOUJOURS avec son
 * fond : elle ne fait que glisser d'un onglet à l'autre.
 *
 * Mesuré sur Android (Fabric, RN 0.81) : une capsule à `borderRadius` dont
 * le fond n'apparaissait qu'à l'activation était rendue CARRÉE — la vue
 * n'existait pas tant qu'elle n'avait pas de fond (aplatissement), puis
 * était créée avec les seules props du dernier diff, le rayon en moins.
 * Un indicateur unique et permanent n'emprunte jamais ce chemin ;
 * `collapsable={false}` en ceinture.
 *
 * Neutre (`fill.soft`, la pilule glissante de la nav web) : la couleur de
 * marque va à l'icône et au libellé, pas au fond.
 */
export function TabIndicator({ width, height, style }: Props) {
  const st = useThemedStyles(makeStyles);
  return (
    <Animated.View
      collapsable={false}
      pointerEvents="none"
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[st.pill, { width, height }, style]}
    />
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    pill: {
      position: "absolute" as const,
      left: 0,
      top: 0,
      borderRadius: 999,
      backgroundColor: t.colors.fill.soft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
    },
  });
