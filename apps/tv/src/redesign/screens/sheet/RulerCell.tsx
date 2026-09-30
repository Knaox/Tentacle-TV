import { memo, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, white } from "../../theme/tokens";

/**
 * Un cran de l'échelle horizontale (`RatingRuler`) : sa valeur, « 7 ». Le
 * cran visé est au CENTRE ; les autres pâlissent avec la distance, comme sur
 * une molette. Au focus, le cran devient BLANC et grandit un peu — pas
 * d'anneau. La note posée porte un point au rose de la marque. `remove` :
 * « Retirer la note », au bout, en rouge ; sans note posée (retirée depuis
 * l'ouverture), il reste à sa place, éteint.
 */

export const RULER_CELL = { width: 104, height: 96, gap: 10, removeWidth: 240 } as const;

/** L'opacité d'un cran selon sa distance au centre. */
function fadeOf(distance: number): number {
  return [1, 0.72, 0.5, 0.36][distance] ?? 0.26;
}

export const RulerCell = memo(function RulerCell({
  score,
  label,
  distance,
  current = false,
  disabled = false,
  focusKey,
  onPress,
  onFocusChange,
}: {
  /** La valeur du cran, 1 à 10 ; `null` : « Retirer la note ». */
  score: number | null;
  /** Le libellé dit (« Noter 7 sur 10 », « Retirer la note »). */
  label: string;
  /** Le nombre de crans jusqu'au centre. */
  distance: number;
  /** Ce cran est la note posée. */
  current?: boolean;
  /** L'échelle attend sa note, ou le retrait n'a plus rien à retirer. */
  disabled?: boolean;
  focusKey: string;
  onPress?: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <FocusTarget
      focusKey={focusKey}
      onPress={onPress}
      onFocusChange={onFocusChange}
      disabled={disabled && score !== null}
      accessibilityLabel={label}
    >
      {(focused) => <Cell score={score} label={label} distance={distance} current={current} off={disabled} focused={focused} />}
    </FocusTarget>
  );
});

function Cell({ score, label, distance, current, off, focused }: {
  score: number | null;
  label: string;
  distance: number;
  current: boolean;
  off: boolean;
  focused: boolean;
}) {
  const reduced = useReducedMotion();
  const p = useFocusProgress(focused);
  const fade = useSharedValue(fadeOf(distance));
  useEffect(() => {
    fade.value = withTiming(fadeOf(distance), { duration: reduced ? 0 : 200 });
  }, [distance, reduced, fade]);
  const shape = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: 1 + 0.08 * p.value }] }));
  const light = useAnimatedStyle(() => ({ opacity: p.value }));
  const remove = score === null;
  return (
    <Animated.View style={[styles.cell, remove && styles.remove, off && styles.off, shape]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.light, light]} />
      {remove ? (
        <>
          {/* Sur le blanc du focus, le rouge franc ; sur le sombre, le rouge clair. */}
          <Icon name="xCircle" size={28} color={focused ? colors.error : colors.errorFg} strokeWidth={2.2} />
          <Text style={[styles.removeLabel, focused && styles.removeFocused]} numberOfLines={1}>{label}</Text>
        </>
      ) : (
        <>
          <Text style={[styles.value, current && styles.currentValue, focused && styles.focusedValue]}>{score}</Text>
          {current ? <View style={[styles.dot, focused && styles.dotFocused]} /> : null}
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: RULER_CELL.width,
    height: RULER_CELL.height,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: white(0.06),
  },
  remove: { width: RULER_CELL.removeWidth, flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  off: { backgroundColor: white(0.03) },
  light: { borderRadius: 26, backgroundColor: colors.ctaBg },
  value: { ...fonts.semibold, fontSize: 38, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  currentValue: { ...fonts.bold, color: colors.accentLight },
  focusedValue: { ...fonts.extrabold, fontSize: 44, color: colors.ctaFg },
  dot: { position: "absolute", bottom: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  dotFocused: { backgroundColor: colors.accentDeep },
  removeLabel: { ...fonts.semibold, fontSize: 24, color: colors.errorFg, flexShrink: 1 },
  removeFocused: { ...fonts.bold, color: colors.error },
});
