import { memo, useCallback, type ReactNode } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { useFocusDressing } from "../cards/CardFocusDressing";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, scrim, white } from "../theme/tokens";
import { useNavFrame } from "./navFrame";
import { ITEM, LABEL_GAP } from "./navGeometry";
import { navText } from "./navText";

/**
 * Une entrée de la navigation : pictogramme seul quand la barre est
 * repliée, pictogramme et libellé quand elle s'ouvre (et, pour le profil, une
 * seconde ligne sous le nom). L'entrée de la page courante porte le verre
 * allumé de la maquette ; celle qui a le focus devient blanche, texte noir.
 *
 * Sa largeur, son ouverture et l'apparition de ses libellés viennent du rail
 * (`useNavFrame`) : ouverte, elle prend la largeur que le texte le plus long
 * du rail lui donne ; ses libellés paraissent et s'effacent avec le verre.
 *
 * Deux états d'organisation :
 * - `held` : son menu d'appui long est ouvert — un liseré de la marque dit de
 *   quelle entrée il parle ;
 * - `moving` : on la déplace — son pictogramme devient la flèche double,
 *   la pilule blanche porte le liseré de la marque.
 *
 * `fade` : le fondu du défilement, posé sur le dessin seulement — la cible
 * focalisable, elle, reste opaque (le moteur de focus l'ignore sinon).
 *
 * La pilule blanche du focus et son dessin noir (pictogramme, libellés)
 * n'existent qu'avec le focus et le temps de son retour (`FocusFill`) : au
 * repos, elle vaut zéro. Montée pour chaque entrée, elle doublait le rail —
 * un pictogramme de plus par entrée, et, rail ouvert, des libellés
 * invisibles qui glissaient à chaque image avec les autres.
 */

export type NavItemMode = "held" | "moving";

export interface NavItemProps {
  itemKey: string;
  label: string;
  /** Seconde ligne, barre ouverte (le profil : « Réglages »). */
  caption?: string;
  icon?: IconName;
  /** Portrait du compte (capsule du profil). */
  avatarUri?: string;
  initial?: string;
  /** Un pictogramme dessiné, à la place de `icon` (l'empilement des profils de « Changer de profil »).
   *  Reçoit la couleur du texte : celle du repos, ou le noir de la pilule focalisée. */
  glyph?: (color: string) => ReactNode;
  active: boolean;
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
      form="row"
      onPress={onSelect ? press : undefined}
      onLongPress={onLongPress ? longPress : undefined}
      onFocusChange={focusChange}
      accessibilityLabel={caption ? `${label}, ${caption}` : label}
    >
      {(focused) => <Body {...props} focused={focused} />}
    </FocusTarget>
  );
});

function Glyph({ icon, avatarUri, initial, glyph, color }: { icon?: IconName; avatarUri?: string; initial?: string; glyph?: (color: string) => ReactNode; color: string }) {
  if (glyph) return <>{glyph(color)}</>;
  if (avatarUri) return <Image source={{ uri: avatarUri }} style={styles.avatar} fadeDuration={0} />;
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
  /** Les libellés sont dessinés, dans une colonne de cette largeur. */
  labels: boolean;
  labelWidth: number;
  dark: boolean;
  labelIn: StyleProp<ViewStyle>;
}

function Row({ props, width, labels, labelWidth, dark, labelIn }: RowProps) {
  const { label, caption, icon, avatarUri, initial, glyph, active, mode } = props;
  const color = dark ? colors.ctaFg : active || mode ? colors.text : colors.textSecondary;
  const bold = dark || active || !!mode;
  return (
    <View style={[styles.row, { width }]}>
      <View style={styles.glyph}>
        <Glyph icon={mode === "moving" ? "moveVertical" : icon} avatarUri={avatarUri} initial={initial} glyph={glyph} color={color} />
      </View>
      {labels ? (
        <Animated.View style={[styles.texts, { width: labelWidth }, labelIn]}>
          <Text style={[bold ? navText.labelBold : navText.label, { color }]} numberOfLines={1}>
            {label}
          </Text>
          {caption ? (
            <Text style={[navText.caption, { color: dark ? scrim(0.6) : colors.textTertiary }]} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Body(props: NavItemProps & { focused: boolean }) {
  const { active, mode, fade, focused } = props;
  const { expanded, openness, itemWidth, labels, labelWidth } = useNavFrame();
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (mode === "moving" ? 0.06 : 0.04) * p.value }] }));
  const labelIn = useAnimatedStyle(() => ({ opacity: openness.value, transform: [{ translateX: -12 * (1 - openness.value) }] }));
  const [dressed, settle] = useFocusDressing(focused);
  return (
    <Animated.View style={[{ width: itemWidth, height: ITEM }, lift, fade]}>
      {active ? <View style={[StyleSheet.absoluteFill, styles.activeGlass]} /> : null}
      {mode === "held" ? <View style={[StyleSheet.absoluteFill, styles.held]} /> : null}
      <Row props={props} width={itemWidth} labels={labels} labelWidth={labelWidth} dark={false} labelIn={labelIn} />
      {/* Le texte noir de la pilule blanche n'existe que rail ouvert : au
          repli, la pilule est déjà réduite à son pictogramme. */}
      {dressed ? (
        <FocusFill progress={p} focused={focused} onSettled={settle}>
          <Row props={props} width={itemWidth} labels={expanded} labelWidth={labelWidth} dark labelIn={labelIn} />
        </FocusFill>
      ) : null}
      {mode ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.ring]} /> : null}
    </Animated.View>
  );
}

/** La pilule blanche, en fondu avec le focus ; elle dit quand elle s'est
 *  éteinte, focus parti (`useFocusDressing` la démonte alors). */
function FocusFill({ progress, focused, onSettled, children }: { progress: SharedValue<number>; focused: boolean; onSettled: () => void; children: ReactNode }) {
  const whiteLayer = useAnimatedStyle(() => ({ opacity: progress.value }));
  useAnimatedReaction(
    () => progress.value < 0.002,
    (rested, previous) => {
      if (!focused && rested && previous !== true) runOnJS(onSettled)();
    },
    [focused, onSettled],
  );
  return <Animated.View style={[StyleSheet.absoluteFill, styles.focusFill, whiteLayer]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  row: { height: ITEM, flexDirection: "row", alignItems: "center" },
  glyph: { width: ITEM, height: ITEM, alignItems: "center", justifyContent: "center" },
  // Posés à côté du pictogramme, à la largeur du rail ouvert : au repli, ils
  // s'effacent pendant que l'entrée a déjà repris sa taille de pictogramme.
  texts: { position: "absolute", left: ITEM + LABEL_GAP, top: 0, bottom: 0, justifyContent: "center" },
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
