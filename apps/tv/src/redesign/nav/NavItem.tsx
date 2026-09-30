import { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, white } from "../theme/tokens";

/**
 * Une entrée de la navigation : pictogramme seul quand la barre est
 * repliée, pictogramme et libellé quand elle s'ouvre. L'entrée de la page
 * courante porte le verre allumé de la maquette ; celle qui a le focus
 * devient blanche, texte noir.
 */

export interface NavItemProps {
  itemKey: string;
  label: string;
  icon?: IconName;
  /** Portrait du compte (entrée du bas). */
  avatarUri?: string;
  initial?: string;
  active: boolean;
  expanded: boolean;
  /** 0 → 1 à l'ouverture de la barre : l'apparition des libellés. */
  openness: SharedValue<number>;
  onPress?: () => void;
  onLongPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const N = TV_STAGE.nav;
const EXPANDED_ITEM = N.expandedWidth - 32;

export const NavItem = memo(function NavItem(props: NavItemProps) {
  return (
    <FocusTarget
      focusKey={`nav:${props.itemKey}`}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      onFocusChange={props.onFocusChange}
      accessibilityLabel={props.label}
    >
      {(focused) => <Body {...props} focused={focused} />}
    </FocusTarget>
  );
});

function Glyph({ icon, avatarUri, initial, color }: { icon?: IconName; avatarUri?: string; initial?: string; color: string }) {
  if (avatarUri) return <Image source={{ uri: avatarUri }} style={styles.avatar} />;
  if (initial) {
    return (
      <View style={[styles.avatar, styles.initialBox]}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
    );
  }
  return icon ? <Icon name={icon} size={N.icon} color={color} /> : null;
}

function Body({ label, icon, avatarUri, initial, active, expanded, openness, focused }: NavItemProps & { focused: boolean }) {
  const p = useFocusProgress(focused, 180);
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.04 * p.value }] }));
  const labelIn = useAnimatedStyle(() => ({ opacity: openness.value, transform: [{ translateX: -12 * (1 - openness.value) }] }));
  const width = expanded ? EXPANDED_ITEM : N.itemHeight;
  const idle = active ? colors.text : colors.textSecondary;
  const row = (color: string, bold: boolean) => (
    <View style={[styles.row, { width }]}>
      <View style={styles.glyph}>
        <Glyph icon={icon} avatarUri={avatarUri} initial={initial} color={color} />
      </View>
      {expanded ? (
        <Animated.Text style={[bold ? styles.labelBold : styles.label, { color }, labelIn]} numberOfLines={1}>
          {label}
        </Animated.Text>
      ) : null}
    </View>
  );
  return (
    <Animated.View style={[{ width, height: N.itemHeight }, lift]}>
      {active ? <View style={[StyleSheet.absoluteFill, styles.activeGlass]} /> : null}
      {row(idle, active)}
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>
        {row(colors.ctaFg, true)}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { height: N.itemHeight, flexDirection: "row", alignItems: "center" },
  glyph: { width: N.itemHeight, height: N.itemHeight, alignItems: "center", justifyContent: "center" },
  label: { ...fonts.semibold, fontSize: 26, marginLeft: 4, flexShrink: 1 },
  labelBold: { ...fonts.bold, fontSize: 26, marginLeft: 4, flexShrink: 1 },
  activeGlass: {
    borderRadius: N.itemRadius,
    backgroundColor: white(0.2),
    borderWidth: 1,
    borderColor: white(0.18),
  },
  focusFill: { borderRadius: N.itemRadius, backgroundColor: colors.ctaBg },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  initialBox: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  initial: { ...fonts.extrabold, fontSize: 22, color: colors.onAccent },
});
