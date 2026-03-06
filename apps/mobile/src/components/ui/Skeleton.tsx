import { useEffect, useRef } from "react";
import { Animated, type ViewStyle } from "react-native";
import { colors } from "../../theme";

interface Props {
  width: number | string;
  height: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width, height, radius = 8, style }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{
        width: width as number,
        height,
        borderRadius: radius,
        backgroundColor: colors.surfaceElevated,
        opacity,
      }, style]}
    />
  );
}

export function SkeletonCard({ width = 120, height = 180 }: { width?: number; height?: number }) {
  return <Skeleton width={width} height={height} radius={10} />;
}

export function SkeletonRow({ count = 4, cardWidth = 120, cardHeight = 180 }: {
  count?: number; cardWidth?: number; cardHeight?: number;
}) {
  return (
    <Animated.View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} width={cardWidth} height={cardHeight} />
      ))}
    </Animated.View>
  );
}

export function SkeletonHero() {
  return <Skeleton width="100%" height={260} radius={0} />;
}
