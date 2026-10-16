import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import { DropShadow } from "../../render/DropShadow";

/**
 * Une ligne de la FICHE d'un profil (« Gérer les profils ») : toute la ligne
 * est le bouton, comme un réglage (`ToggleRow`) — l'icône, ce que fait le
 * geste, une phrase dessous, et à droite l'état en toutes lettres (« Activé »)
 * puis un chevron quand le geste ouvre une page. Au focus, la ligne devient
 * blanche et s'avance à peine.
 *
 * `danger` (supprimer, retirer) : le titre en rouge ; ARMÉE (premier appui,
 * tv-core `confirmPress`), la ligne passe au rouge plein et dit ce qui va se
 * passer — le second appui exécute, quitter la ligne désarme.
 */

export interface SheetRowProps {
  icon?: IconName;
  /** À la place de l'icône : le portrait d'un profil (la liste de la gestion). */
  leading?: ReactNode;
  /** Plus serrée (la liste, jusqu'à six profils sans défiler). */
  compact?: boolean;
  title: string;
  description?: string;
  /** L'état, à droite (« Activé », « Aucun code »). */
  state?: string;
  /** Le geste ouvre une page : un chevron. */
  opens?: boolean;
  tone?: "default" | "danger";
  armed?: boolean;
  focusKey: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const RADIUS = 28;

export const SheetRow = memo(function SheetRow(props: SheetRowProps) {
  const label = [props.title, props.state, props.description].filter(Boolean).join(", ");
  return (
    <FocusTarget focusKey={props.focusKey} form="row" onPress={props.onPress} onFocusChange={props.onFocusChange} accessibilityLabel={label}>
      {(focused) => <Body {...props} focused={focused} />}
    </FocusTarget>
  );
});

/** La même ligne, sans focus : un profil que la session ne gère pas (le propriétaire, elle-même). */
export const SheetRowStatic = memo(function SheetRowStatic(props: Omit<SheetRowProps, "focusKey" | "onPress" | "onFocusChange">) {
  return (
    <View accessible accessibilityLabel={[props.title, props.description].filter(Boolean).join(", ")}>
      <GlassSurface radius={RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      <Content {...props} focusKey="" dark={false} />
    </View>
  );
});

function Content({ icon, leading, compact, title, description, state, opens, tone, armed, dark }: SheetRowProps & { dark: boolean }) {
  const danger = tone === "danger";
  const filled = armed && danger;
  const main = filled ? colors.text : danger ? (dark ? colors.error : colors.errorFg) : dark ? colors.ctaFg : colors.text;
  const soft = filled ? white(0.85) : dark ? scrim(0.62) : colors.textSecondary;
  return (
    <View style={[styles.row, compact ? styles.compact : null]}>
      {leading ?? (icon ? (
        <View style={[styles.iconDisc, { backgroundColor: dark && !filled ? scrim(0.08) : white(0.1) }]}>
          <Icon name={icon} size={28} color={main} strokeWidth={2.2} />
        </View>
      ) : null)}
      <View style={styles.texts}>
        <Text style={[styles.title, { color: main }]} numberOfLines={1}>{title}</Text>
        {description ? <Text style={[styles.description, { color: soft }]} numberOfLines={2}>{description}</Text> : null}
      </View>
      {state ? <Text style={[styles.state, { color: soft }]}>{state}</Text> : null}
      {opens ? <Icon name="chevronRight" size={30} color={soft} strokeWidth={2.4} /> : null}
    </View>
  );
}

function Body(props: SheetRowProps & { focused: boolean }) {
  const p = useFocusProgress(props.focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.02 * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const filled = props.armed && props.tone === "danger";
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, onLayer]}>
        <DropShadow of={styles.shadow} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={offLayer}>
        <Content {...props} dark={false} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: filled ? colors.error : colors.ctaBg }, onLayer]}>
        <Content {...props} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 24, paddingVertical: 18, paddingHorizontal: 28, minHeight: 96 },
  compact: { paddingVertical: 10, minHeight: 84 },
  iconDisc: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  texts: { flex: 1, gap: 4 },
  title: { ...fonts.bold, fontSize: 30, lineHeight: 38 },
  description: { ...fonts.regular, fontSize: 23, lineHeight: 30 },
  state: { ...fonts.semibold, fontSize: 24, lineHeight: 30 },
  fill: { borderRadius: RADIUS },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 26,
  },
});
