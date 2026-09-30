import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";

/**
 * Un réglage oui/non : toute la ligne est le bouton — OK bascule. Le titre
 * dit ce qu'on règle, la phrase dessous ce que ça change, et à droite
 * l'interrupteur et son état en toutes lettres (« Activé ») : à 3 m, la
 * position d'un pouce ne suffit pas à dire où on en est.
 *
 * Au focus, la ligne devient blanche (texte noir) et s'avance à peine — elle
 * est large. Activé, la piste prend le rose de l'accent.
 */

export interface ToggleRowProps {
  icon: IconName;
  title: string;
  description?: string;
  value: boolean;
  onLabel: string;
  offLabel: string;
  focusKey: string;
  onToggle?: (next: boolean) => void;
}

const RADIUS = 30;
const TRACK = { width: 88, height: 50 };
const KNOB = 40;
const TRAVEL = TRACK.width - KNOB - 10;

export const ToggleRow = memo(function ToggleRow(props: ToggleRowProps) {
  const { value, onToggle } = props;
  return (
    <FocusTarget
      focusKey={props.focusKey}
      onPress={onToggle ? () => onToggle(!value) : undefined}
      accessibilityLabel={`${props.title} : ${value ? props.onLabel : props.offLabel}`}
    >
      {(focused) => <Body {...props} focused={focused} />}
    </FocusTarget>
  );
});

function SwitchTrack({ value, dark }: { value: boolean; dark: boolean }) {
  const on = useFocusProgress(value, 200);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: TRAVEL * on.value }] }));
  const track = value ? colors.accent : dark ? scrim(0.16) : white(0.22);
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.knob, knob]} />
    </View>
  );
}

function Content({ icon, title, description, value, onLabel, offLabel, dark }: ToggleRowProps & { dark: boolean }) {
  const main = dark ? colors.ctaFg : colors.text;
  const soft = dark ? scrim(0.62) : colors.textSecondary;
  return (
    <View style={styles.row}>
      <View style={[styles.iconDisc, { backgroundColor: dark ? scrim(0.08) : white(0.1) }]}>
        <Icon name={icon} size={30} color={main} strokeWidth={2.2} />
      </View>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: main }]}>{title}</Text>
        {description ? <Text style={[styles.description, { color: soft }]}>{description}</Text> : null}
      </View>
      <View style={styles.state}>
        <Text style={[styles.stateLabel, { color: value ? main : soft }]}>{value ? onLabel : offLabel}</Text>
        <SwitchTrack value={value} dark={dark} />
      </View>
    </View>
  );
}

function Body(props: ToggleRowProps & { focused: boolean }) {
  const p = useFocusProgress(props.focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.02 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, onLayer]} />
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={offLayer}>
        <Content {...props} dark={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, onLayer]}>
        <Content {...props} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 26, paddingVertical: 26, paddingHorizontal: 30 },
  iconDisc: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 6 },
  title: { ...fonts.bold, fontSize: 30, lineHeight: 38 },
  description: { ...fonts.regular, fontSize: 24, lineHeight: 34 },
  state: { alignItems: "flex-end", gap: 10, minWidth: 150 },
  stateLabel: { ...fonts.semibold, fontSize: 24, lineHeight: 30 },
  track: { width: TRACK.width, height: TRACK.height, borderRadius: TRACK.height / 2, justifyContent: "center", paddingHorizontal: 5 },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  focusFill: { borderRadius: RADIUS, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
  },
});
