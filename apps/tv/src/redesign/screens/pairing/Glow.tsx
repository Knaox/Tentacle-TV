import { memo } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

/**
 * Une lumière ronde posée derrière un motif (la mascotte de l'accueil, la
 * coche du succès) : un dégradé radial, sans flou à calculer, immobile.
 */
export const Glow = memo(function Glow({ size, color, opacity = 0.4, style }: {
  size: number;
  color: string;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={style} pointerEvents="none">
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.45" stopColor={color} stopOpacity={opacity * 0.45} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r} fill="url(#glow)" />
    </Svg>
  );
});
