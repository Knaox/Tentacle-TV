import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { Colors, CardConfig, Radius } from "../theme/colors";

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/** Base shimmer skeleton block */
export function Skeleton({ width, height, borderRadius = Radius.card, style }: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: Colors.bgElevated,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Skeleton for a portrait media card (poster) */
export function SkeletonCardPortrait() {
  const w = CardConfig.portrait.width;
  const h = w / CardConfig.portrait.aspectRatio;
  return (
    <View style={{ width: w, marginRight: 20 }}>
      <Skeleton width={w} height={h} />
      <Skeleton width={w * 0.8} height={14} borderRadius={4} style={{ marginTop: 12 }} />
      <Skeleton width={w * 0.5} height={12} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  );
}

/** Skeleton for a landscape media card (thumbnail) */
export function SkeletonCardLandscape() {
  const w = CardConfig.landscape.width;
  const h = w / CardConfig.landscape.aspectRatio;
  return (
    <View style={{ width: w, marginRight: 20 }}>
      <Skeleton width={w} height={h} />
      <Skeleton width={w * 0.7} height={14} borderRadius={4} style={{ marginTop: 12 }} />
      <Skeleton width={w * 0.4} height={12} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  );
}

/** Skeleton for the hero banner */
export function SkeletonHero({ height }: { height: number }) {
  return (
    <View style={{ width: "100%", height }}>
      <Skeleton width="100%" height={height} borderRadius={0} />
      <View style={{ position: "absolute", bottom: 80, left: 60 }}>
        <Skeleton width={400} height={48} borderRadius={8} />
        <Skeleton width={280} height={18} borderRadius={4} style={{ marginTop: 16 }} />
        <Skeleton width={500} height={16} borderRadius={4} style={{ marginTop: 12 }} />
        <Skeleton width={460} height={16} borderRadius={4} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: "row", gap: 16, marginTop: 32 }}>
          <Skeleton width={160} height={52} borderRadius={Radius.button} />
          <Skeleton width={160} height={52} borderRadius={Radius.button} />
        </View>
      </View>
    </View>
  );
}

/** Skeleton for a full carousel row (title + cards) */
export function SkeletonRow({ landscape = false }: { landscape?: boolean }) {
  const Card = landscape ? SkeletonCardLandscape : SkeletonCardPortrait;
  const count = landscape ? 4 : 6;
  return (
    <View style={{ paddingLeft: 60, marginTop: 56 }}>
      <Skeleton width={200} height={24} borderRadius={4} style={{ marginBottom: 20 }} />
      <View style={{ flexDirection: "row" }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i} />
        ))}
      </View>
    </View>
  );
}
