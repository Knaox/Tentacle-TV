import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { PLAYER, motion } from "@/theme";

/** La traversée du segment — celle du web (`animate-loading-bar`, 1,15 s). */
const SWEEP_MS = 1_150;
const SEGMENT_RATIO = 0.25;

/**
 * La barre de chargement du lecteur : un segment de marque qui traverse un rail
 * fin, en boucle — le même geste que le web et le bureau. En TRANSLATION
 * seulement (aucune peinture par image). « Réduire les animations » : une
 * barre pleine qui respire, sans déplacement.
 */
export function LoadingBar() {
  const [width, setWidth] = useState(0);
  const reduced = motion.isReducedMotion();
  const x = useSharedValue(0);
  const glow = useSharedValue(0.35);

  useEffect(() => {
    if (reduced) {
      glow.value = withRepeat(withSequence(withTiming(0.9, { duration: 900 }), withTiming(0.35, { duration: 900 })), -1);
      return () => cancelAnimation(glow);
    }
    if (width === 0) return;
    const segment = width * SEGMENT_RATIO;
    x.value = -segment;
    x.value = withRepeat(withTiming(width, { duration: SWEEP_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) }), -1);
    return () => cancelAnimation(x);
  }, [width, reduced]); // eslint-disable-line react-hooks/exhaustive-deps

  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const breathe = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <View style={st.track} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {reduced ? (
        // La couleur de marque se lit au rendu : elle suit le thème de l'admin.
        <Animated.View style={[st.full, { backgroundColor: PLAYER.accent }, breathe]} />
      ) : (
        <Animated.View style={[st.segment, { width: width * SEGMENT_RATIO }, sweep]}>
          <LinearGradient
            colors={["transparent", PLAYER.accentLight, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: PLAYER.borderSubtle,
  },
  segment: { position: "absolute", top: 0, bottom: 0, left: 0 },
  full: { ...StyleSheet.absoluteFillObject },
});
