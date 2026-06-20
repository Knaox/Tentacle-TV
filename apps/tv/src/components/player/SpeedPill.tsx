import { memo, useEffect, useState } from "react";
import { Text } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { Colors } from "../../theme/colors";

/**
 * Pastille de vitesse façon YouTube/DVD pendant l'avance rapide shuttle :
 * « ▶▶ 2x / 4x / 8x » (ou ◀◀ en recul). Le label vient du moteur de scrub via
 * l'adaptateur de gestes ; null → fondu sortant. Animation fade + léger scale.
 */
export const SpeedPill = memo(function SpeedPill({ label }: { label: string | null }) {
  const visible = !!label;
  // Conserver le dernier label pendant le fondu sortant.
  const [shown, setShown] = useState<string | null>(label);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);

  useEffect(() => {
    if (label) setShown(label);
    opacity.value = withTiming(visible ? 1 : 0, { duration: visible ? 140 : 200 });
    scale.value = withTiming(visible ? 1 : 0.85, { duration: visible ? 160 : 200 });
  }, [label, visible, opacity, scale]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));

  if (!shown) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[{
        position: "absolute", top: "42%", alignSelf: "center",
        backgroundColor: "rgba(0,0,0,0.62)", borderRadius: 999,
        paddingHorizontal: 26, paddingVertical: 12,
        borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
      }, style]}
    >
      <Text style={{
        color: Colors.textPrimary, fontSize: 26, fontWeight: "800",
        fontVariant: ["tabular-nums"], letterSpacing: 1,
      }}>
        {shown}
      </Text>
    </Animated.View>
  );
});
