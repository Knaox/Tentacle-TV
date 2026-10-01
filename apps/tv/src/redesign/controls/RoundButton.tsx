import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { pressScale, usePressProgress } from "../motion/pressProgress";
import { GlassSurface } from "../glass/GlassSurface";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts } from "../theme/tokens";

/**
 * Le bouton rond de verre : Ma liste, favori, vu, note. Son libellé s'écrit
 * DESSOUS, et ne paraît qu'au focus — un rond ne dit pas ce qu'il fait.
 * `active` : l'état est posé (pictogramme rose plein).
 */

export interface RoundButtonProps {
  icon: IconName;
  label: string;
  active?: boolean;
  /** Pictogramme à montrer quand `active` (ex. coche pour « vu »). */
  activeIcon?: IconName;
  size?: number;
  focusKey?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const RoundButton = memo(function RoundButton({
  icon,
  label,
  active = false,
  activeIcon,
  size = 68,
  focusKey,
  onPress,
  onFocusChange,
}: RoundButtonProps) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={label}>
      {(focused) => (
        <Round focused={focused} icon={active && activeIcon ? activeIcon : icon} active={active} size={size} label={label} />
      )}
    </FocusTarget>
  );
});

function Round({ focused, icon, active, size, label }: { focused: boolean; icon: IconName; active: boolean; size: number; label: string }) {
  const p = useFocusProgress(focused);
  const press = usePressProgress();
  const lift = useAnimatedStyle(() => ({
    transform: [{ scale: (1 + (TV_STAGE.focus.buttonScale + 0.04 - 1) * p.value) * pressScale(press ? press.value : 0) }],
  }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: p.value }));
  const caption = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 6 * (1 - p.value) }] }));
  const idle = active ? colors.accent : colors.text;
  return (
    <View style={styles.column}>
      <Animated.View style={[{ width: size, height: size }, lift]}>
        <GlassSurface radius={size / 2} tone="clear" style={StyleSheet.absoluteFill} />
        <View style={styles.center}>
          <Icon name={icon} size={size * 0.42} color={idle} strokeWidth={2.2} />
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, { borderRadius: size / 2, backgroundColor: colors.ctaBg }, whiteLayer]}>
          <Icon name={icon} size={size * 0.42} color={active ? colors.accentDeep : colors.ctaFg} strokeWidth={2.4} />
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.captionBox, caption]}>
        <Text style={styles.caption} numberOfLines={1}>{label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  captionBox: { position: "absolute", top: "100%", marginTop: 14, width: 260, alignItems: "center" },
  caption: { ...fonts.semibold, fontSize: 22, color: colors.text },
});
