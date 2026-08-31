import { useEffect } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme";
import { useHeroMetrics } from "../heroMetrics";

interface Props {
  width: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * Loading shimmer — Reanimated 3, gradient horizontal qui glisse.
 * Plus Netflix que le pulse opacity classique. ~1.4s par cycle.
 */
export function Skeleton({ width, height, radius = 10, style }: Props) {
  const theme = useTheme();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [progress]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 240 - 120 }],
  }));

  return (
    <View
      style={[
        {
          width: width as number,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.surface.s2,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFillObject, animStyle]}>
        <LinearGradient
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={["transparent", theme.colors.fill.shimmer, "transparent"]}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonCard({ width = 120, height = 180 }: { width?: number; height?: number }) {
  return <Skeleton width={width} height={height} radius={10} />;
}

export function SkeletonRow({
  count = 4, cardWidth = 120, cardHeight = 180,
}: { count?: number; cardWidth?: number; cardHeight?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} width={cardWidth} height={cardHeight} />
      ))}
    </View>
  );
}

export function SkeletonHero() {
  // La MÊME géométrie que la carte hero (useHeroMetrics) : un squelette de
  // 420 px pour un hero à ~620 faisait sauter toute la page à l'arrivée des
  // données.
  const { bannerH, slideW, margin, radius } = useHeroMetrics();
  return (
    <View style={{ paddingHorizontal: margin }}>
      <Skeleton width={slideW} height={bannerH} radius={radius} />
    </View>
  );
}
