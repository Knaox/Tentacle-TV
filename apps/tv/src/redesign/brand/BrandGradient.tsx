import { memo } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { brandGradient } from "../theme/tokens";

/**
 * Le dégradé de la marque, violet → rose — la couleur de l'app, posée en
 * touches : le bouton de lecture, les barres de progression, « Demander ».
 * Horizontal par défaut (une progression se remplit de gauche à droite) ;
 * `diagonal` pour une pilule, à 120° comme le bouton Lire du bureau
 * (`DetailPlayButton`). Remplit son parent.
 */
export const BrandGradient = memo(function BrandGradient({
  diagonal = false,
  style,
}: {
  diagonal?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <LinearGradient
      colors={brandGradient}
      start={diagonal ? { x: 0, y: 0.2 } : { x: 0, y: 0.5 }}
      end={diagonal ? { x: 1, y: 0.8 } : { x: 1, y: 0.5 }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
});
