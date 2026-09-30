import { memo, useCallback } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, scrim, white } from "../theme/tokens";
import { EXPANDED_ITEM } from "./navGeometry";

/**
 * Une entrée de la navigation : pictogramme seul quand la barre est
 * repliée, pictogramme et libellé quand elle s'ouvre (et, pour le profil, une
 * seconde ligne sous le nom). L'entrée de la page courante porte le verre
 * allumé de la maquette ; celle qui a le focus devient blanche, texte noir.
 *
 * Deux états d'organisation :
 * - `held` : son menu d'appui long est ouvert — un liseré de la marque dit de
 *   quelle entrée il parle ;
 * - `moving` : on la déplace — son pictogramme devient la flèche double,
 *   la pilule blanche porte le liseré de la marque.
 *
 * `fade` : le fondu du défilement, posé sur le dessin seulement — la cible
 * focalisable, elle, reste opaque (le moteur de focus l'ignore sinon).
 */

export type NavItemMode = "held" | "moving";

export interface NavItemProps {
  itemKey: string;
  label: string;
  /** Seconde ligne, barre ouverte (le profil : « Profil et réglages »). */
  caption?: string;
  icon?: IconName;
  /** Portrait du compte (capsule du profil). */
  avatarUri?: string;
  initial?: string;
  active: boolean;
  expanded: boolean;
  /** 0 → 1 à l'ouverture de la barre : l'apparition des libellés. */
  openness: SharedValue<number>;
  mode?: NavItemMode | null;
  fade?: StyleProp<ViewStyle>;
  onSelect?: (key: string) => void;
  onLongPress?: (key: string) => void;
  onFocusChange?: (key: string, focused: boolean) => void;
}

const N = TV_STAGE.nav;

export const NavItem = memo(function NavItem(props: NavItemProps) {
  const { itemKey, label, caption, onSelect, onLongPress, onFocusChange } = props;
  const press = useCallback(() => onSelect?.(itemKey), [onSelect, itemKey]);
  const longPress = useCallback(() => onLongPress?.(itemKey), [onLongPress, itemKey]);
  const focusChange = useCallback((focused: boolean) => onFocusChange?.(itemKey, focused), [onFocusChange, itemKey]);
  return (
    <FocusTarget
      focusKey={`nav:${itemKey}`}
      onPress={onSelect ? press : undefined}
      onLongPress={onLongPress ? longPress : undefined}
      onFocusChange={focusChange}
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
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

interface RowProps {
  props: NavItemProps;
  width: number;
  dark: boolean;
  labelIn: StyleProp<ViewStyle>;
}

function Row({ props, width, dark, labelIn }: RowProps) {
  const { label, caption, icon, avatarUri, initial, active, expanded, mode } = props;
  const color = dark ? colors.ctaFg : active || mode ? colors.text : colors.textSecondary;
  const bold = dark || active || !!mode;
  return (
    <View style={[styles.row, { width }]}>
      <View style={styles.glyph}>
        <Glyph icon={mode === "moving" ? "moveVertical" : icon} avatarUri={avatarUri} initial={initial} color={color} />
      </View>
      {expanded ? (
        <Animated.View style={[styles.texts, labelIn]}>
          <Text style={[bold ? styles.labelBold : styles.label, { color }]} numberOfLines={1}>
            {label}
          </Text>
          {caption ? (
            <Text style={[styles.caption, { color: dark ? scrim(0.6) : colors.textTertiary }]} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Body(props: NavItemProps & { focused: boolean }) {
  const { active, expanded, openness, mode, fade, focused } = props;
  const p = useFocusProgress(focused, 180);
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (mode === "moving" ? 0.06 : 0.04) * p.value }] }));
  const labelIn = useAnimatedStyle(() => ({ opacity: openness.value, transform: [{ translateX: -12 * (1 - openness.value) }] }));
  const width = expanded ? EXPANDED_ITEM : N.itemHeight;
  return (
    <Animated.View style={[{ width, height: N.itemHeight }, lift, fade]}>
      {active ? <View style={[StyleSheet.absoluteFill, styles.activeGlass]} /> : null}
      {mode === "held" ? <View style={[StyleSheet.absoluteFill, styles.held]} /> : null}
      <Row props={props} width={width} dark={false} labelIn={labelIn} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>
        <Row props={props} width={width} dark labelIn={labelIn} />
      </Animated.View>
      {mode ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring]} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { height: N.itemHeight, flexDirection: "row", alignItems: "center" },
  glyph: { width: N.itemHeight, height: N.itemHeight, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, marginLeft: 4, justifyContent: "center" },
  label: { ...fonts.semibold, fontSize: 26 },
  labelBold: { ...fonts.bold, fontSize: 26 },
  caption: { ...fonts.medium, fontSize: 22, lineHeight: 26, marginTop: -1 },
  activeGlass: {
    borderRadius: N.itemRadius,
    backgroundColor: white(0.2),
    borderWidth: 1,
    borderColor: white(0.18),
  },
  held: { borderRadius: N.itemRadius, backgroundColor: white(0.22) },
  ring: { borderRadius: N.itemRadius, borderWidth: 2, borderColor: colors.accent },
  focusFill: { borderRadius: N.itemRadius, backgroundColor: colors.ctaBg },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  initialBox: { alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  initial: { ...fonts.extrabold, fontSize: 22, color: colors.onAccent },
});
