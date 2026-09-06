import { useEffect, useRef } from "react";
import { Animated, StyleSheet } from "react-native";
import { useTheme } from "@/theme";
import { isReducedMotion } from "@/theme/motion";

interface Props {
  size?: number;
  color?: string;
  /** Position absolue dans le coin du parent (l'anneau ou l'icône). */
  corner?: boolean;
}

/** Le point lumineux qui pulse pendant un transfert (fixe en mouvement réduit). */
export function PulseDot({ size = 8, color, corner = true }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isReducedMotion()) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? colors.brand.accent, opacity },
        corner && styles.corner,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  corner: { position: "absolute", top: -1, right: -1 },
});
