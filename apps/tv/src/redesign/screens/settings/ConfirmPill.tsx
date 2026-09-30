import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";

/**
 * La pilule d'une action qui fait sortir du compte — « Changer de serveur »,
 * « Déconnexion », « Se déconnecter » hors ligne.
 *
 * - repos : verre ; texte blanc, ou rouge pour `danger` ;
 * - focus : blanche, comme toute pilule ; `danger` garde son texte rouge
 *   (la convention tvOS d'une action destructive) ;
 * - `armed` (premier appui d'une action à double appui) : le libellé devient
 *   « Confirmer — … », la pilule `danger` passe au rouge plein.
 * Pas d'anneau : agrandissement et soulèvement, comme les autres pilules.
 */

export interface ConfirmPillProps {
  label: string;
  icon?: IconName;
  tone?: "default" | "danger";
  armed?: boolean;
  /** Le libellé armé (« Confirmer — Déconnexion »). */
  armedLabel?: string;
  focusKey: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const HEIGHT = 68;
const RADIUS = HEIGHT / 2;

export const ConfirmPill = memo(function ConfirmPill(props: ConfirmPillProps) {
  const label = props.armed && props.armedLabel ? props.armedLabel : props.label;
  return (
    <FocusTarget focusKey={props.focusKey} onPress={props.onPress} onFocusChange={props.onFocusChange} accessibilityLabel={label}>
      {(focused) => <Body {...props} label={label} focused={focused} />}
    </FocusTarget>
  );
});

function Row({ label, icon, color }: { label: string; icon?: IconName; color: string }) {
  return (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={26} color={color} strokeWidth={2.4} /> : null}
      <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Body({ label, icon, tone = "default", armed = false, focused }: ConfirmPillProps & { focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (TV_STAGE.focus.buttonScale - 1) * p.value }] }));
  const onLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const offLayer = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  const danger = tone === "danger";
  const armedDanger = armed && danger;
  const shownIcon = armed ? "alert" : icon;
  const idleColor = danger ? colors.errorFg : colors.text;
  const focusBg = armedDanger ? colors.error : colors.ctaBg;
  const focusColor = armedDanger ? colors.text : danger ? colors.error : colors.ctaFg;
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, onLayer]} />
      <Animated.View style={[StyleSheet.absoluteFill, offLayer]}>
        <GlassSurface radius={RADIUS} tone="clear" style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={offLayer}>
        <Row label={label} icon={shownIcon} color={idleColor} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: RADIUS, backgroundColor: focusBg }, onLayer]}>
        <Row label={label} icon={shownIcon} color={focusColor} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { height: HEIGHT, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 36 },
  label: { ...fonts.bold, fontSize: 26 },
  shadow: {
    borderRadius: RADIUS,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
});
