/**
 * Octave (mobile) — l'anneau qui se remplit pendant qu'une collection part sur
 * l'appareil (le pendant de celui du bureau). La progression anime
 * `strokeDashoffset` seulement (aucune remise en page) ; mouvement réduit : la
 * valeur est posée sans ressort.
 */

import { memo, useEffect } from "react";
import Animated, { ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  fraction: number;
  size: number;
  stroke: number;
  color: string;
  track: string;
}

export const ProgressRing = memo(function ProgressRing({ fraction, size, stroke, color, track }: Props) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const shown = useSharedValue(fraction);
  useEffect(() => {
    shown.value = withTiming(Math.max(0, Math.min(1, fraction)), { duration: 240, reduceMotion: ReduceMotion.System });
  }, [fraction, shown]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - shown.value) }));
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${length} ${length}`}
        animatedProps={props}
      />
    </Svg>
  );
});
