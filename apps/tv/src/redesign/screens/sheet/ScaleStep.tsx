import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { RatingStars } from "../../rating/RatingStars";
import { colors, fonts, scrim, white } from "../../theme/tokens";

/**
 * Un cran de l'échelle de la note (`RatingScale`) : la note en étoiles et
 * « 9/10 ». La note posée porte un point au rose de la marque. Au focus, le
 * cran devient BLANC et grandit un peu — pas d'anneau ; ses étoiles passent au
 * violet de la marque, lisible sur le blanc. `remove` : « Retirer la note »,
 * au bout de l'échelle, en rouge.
 */

export const STEP_HEIGHT = 52;

export const ScaleStep = memo(function ScaleStep({
  score,
  label,
  current,
  focusKey,
  onPress,
  onFocusChange,
}: {
  /** La note du cran, sur 10 ; `null` : « Retirer la note ». */
  score: number | null;
  label: string;
  /** Ce cran est la note posée. */
  current?: boolean;
  focusKey: string;
  onPress?: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={label}>
      {(focused) => <Step score={score} label={label} current={current === true} focused={focused} />}
    </FocusTarget>
  );
});

function Step({ score, label, current, focused }: { score: number | null; label: string; current: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * p.value }] }));
  const light = useAnimatedStyle(() => ({ opacity: p.value }));
  const remove = score === null;
  return (
    <Animated.View style={[styles.step, remove && styles.remove, lift]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.light, light]} />
      {remove ? (
        <>
          {/* Sur le blanc du focus, le rouge franc ; sur le sombre, le rouge clair. */}
          <Icon name="xCircle" size={26} color={focused ? colors.error : colors.errorFg} strokeWidth={2.2} />
          <Text style={[styles.label, styles.removeLabel, focused && styles.removeFocused]} numberOfLines={1}>{label}</Text>
        </>
      ) : (
        <>
          <RatingStars
            score={score}
            size={26}
            fill={focused ? colors.accentDeep : colors.accent}
            outline={focused ? scrim(0.28) : white(0.45)}
          />
          <View style={styles.end}>
            {current ? <View style={styles.dot} /> : null}
            <Text style={[styles.label, current && styles.currentLabel, focused && styles.focusedLabel]}>{label}</Text>
          </View>
        </>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  step: {
    height: STEP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    borderRadius: 18,
    backgroundColor: white(0.05),
  },
  remove: { marginTop: 8 },
  light: { borderRadius: 18, backgroundColor: colors.ctaBg },
  end: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  label: { ...fonts.semibold, fontSize: 22, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  currentLabel: { color: colors.accentLight },
  focusedLabel: { ...fonts.bold, color: colors.ctaFg },
  removeLabel: { flex: 1, color: colors.errorFg },
  removeFocused: { ...fonts.bold, color: colors.error },
});
