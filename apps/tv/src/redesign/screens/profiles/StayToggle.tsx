import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { pressScale, usePressProgress } from "../../motion/pressProgress";
import { colors, fonts, white } from "../../theme/tokens";

/**
 * « Ne plus proposer à l'ouverture » : une case DISCRÈTE sous les profils —
 * au repos, ni verre ni fond, une case et un libellé en retrait ; au focus,
 * la pastille blanche de toute cible de la refonte, texte noir. Cochée, la
 * case se remplit. Les deux visages sont deux calques en fondu d'opacité :
 * aucune couleur ne s'anime.
 */

const HEIGHT = 52;
const BOX = 30;

export const StayToggle = memo(function StayToggle({ label, checked, focusKey, accessibilityLabel, disabled, onPress }: {
  label: string;
  checked: boolean;
  focusKey: string;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} accessibilityLabel={accessibilityLabel} disabled={disabled}>
      {(focused) => <Body label={label} checked={checked} focused={focused} />}
    </FocusTarget>
  );
});

function Body({ label, checked, focused }: { label: string; checked: boolean; focused: boolean }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: (1 + 0.05 * p.value) * pressScale(press ? press.value : 0) }] }));
  const focusLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={lift}>
      <Face label={label} checked={checked} focused={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusPill, focusLayer]}>
        <Face label={label} checked={checked} focused />
      </Animated.View>
    </Animated.View>
  );
}

function Face({ label, checked, focused }: { label: string; checked: boolean; focused: boolean }) {
  const ink = focused ? colors.ctaFg : colors.text;
  const box = checked
    ? { backgroundColor: ink, borderColor: ink }
    : { borderColor: focused ? "rgba(0, 0, 0, 0.55)" : white(0.5) };
  return (
    <View style={styles.row}>
      <View style={[styles.box, box]}>
        {checked ? <Icon name="check" size={20} color={focused ? colors.ctaBg : colors.ctaFg} strokeWidth={3} /> : null}
      </View>
      <Text style={[focused ? styles.labelFocused : styles.label, { color: focused ? colors.ctaFg : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: HEIGHT, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22 },
  focusPill: { borderRadius: HEIGHT / 2, backgroundColor: colors.ctaBg },
  box: { width: BOX, height: BOX, borderRadius: 8, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  label: { ...fonts.medium, fontSize: 24 },
  labelFocused: { ...fonts.semibold, fontSize: 24 },
});
