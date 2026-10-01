import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { Icon } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";

/**
 * Une ligne d'une liste en surimpression : une CASE (choix multiple) ou un
 * ROND (choix unique), le libellé, un détail à droite. Cochée, la ligne garde
 * un voile clair et son libellé passe en gras ; au focus elle devient
 * blanche, texte noir — le changement de matière des pilules, jamais un
 * contour.
 */

export interface OptionRowProps {
  label: string;
  detail?: string;
  selected: boolean;
  mode: "check" | "radio";
  width: number;
  focusKey?: string;
  onPress?: () => void;
}

export const OPTION_ROW_HEIGHT = 72;
const RADIUS = 22;

export const OptionRow = memo(function OptionRow(props: OptionRowProps) {
  return (
    <FocusTarget
      focusKey={props.focusKey}
      form="row"
      onPress={props.onPress}
      accessibilityLabel={props.label}
      style={{ width: props.width }}
    >
      {(focused) => <Body {...props} focused={focused} />}
    </FocusTarget>
  );
});

function Mark({ mode, selected, inverted }: { mode: "check" | "radio"; selected: boolean; inverted: boolean }) {
  const on = inverted ? colors.ctaFg : colors.text;
  const off = inverted ? scrim(0.32) : white(0.42);
  if (mode === "radio") {
    return (
      <View style={[styles.radio, { borderColor: selected ? on : off }]}>
        {selected ? <View style={[styles.dot, { backgroundColor: on }]} /> : null}
      </View>
    );
  }
  return (
    <View style={[styles.box, selected ? { backgroundColor: on, borderColor: on } : { borderColor: off }]}>
      {selected ? <Icon name="check" size={22} color={inverted ? colors.ctaBg : colors.ctaFg} strokeWidth={3.2} /> : null}
    </View>
  );
}

function Line({ label, detail, selected, mode, inverted }: {
  label: string;
  detail?: string;
  selected: boolean;
  mode: "check" | "radio";
  inverted: boolean;
}) {
  const color = inverted ? colors.ctaFg : selected ? colors.text : white(0.84);
  return (
    <View style={styles.line}>
      <Mark mode={mode} selected={selected} inverted={inverted} />
      <Text style={[selected ? styles.labelOn : styles.label, { color }]} numberOfLines={1}>{label}</Text>
      {detail ? <Text style={[styles.detail, { color: inverted ? scrim(0.56) : colors.textTertiary }]}>{detail}</Text> : null}
    </View>
  );
}

function Body({ label, detail, selected, mode, focused }: OptionRowProps & { focused: boolean }) {
  const p = useFocusProgress(focused, 180);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.035 * p.value }] }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, whiteLayer]} />
      {selected ? <View style={[StyleSheet.absoluteFill, styles.selectedFill]} /> : null}
      <Line label={label} detail={detail} selected={selected} mode={mode} inverted={false} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>
        <Line label={label} detail={detail} selected={selected} mode={mode} inverted />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  line: { height: OPTION_ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 20, paddingHorizontal: 22 },
  label: { ...fonts.medium, fontSize: 28, flexShrink: 1, flexGrow: 1 },
  labelOn: { ...fonts.bold, fontSize: 28, flexShrink: 1, flexGrow: 1 },
  detail: { ...fonts.medium, fontSize: 24 },
  box: { width: 34, height: 34, borderRadius: 10, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  radio: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  dot: { width: 14, height: 14, borderRadius: 7 },
  selectedFill: { borderRadius: RADIUS, backgroundColor: white(0.09) },
  focusFill: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
});
