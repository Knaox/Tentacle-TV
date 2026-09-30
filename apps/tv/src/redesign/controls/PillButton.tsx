import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../focus/FocusTarget";
import { useFocusProgress } from "../focus/useFocusProgress";
import { GlassSurface } from "../glass/GlassSurface";
import { Icon, type IconName } from "../icons/Icon";
import { colors, fonts, scrim, white } from "../theme/tokens";

/**
 * Le bouton pilule du bureau, à l'échelle du salon.
 *
 * - `primary` : la pilule BLANCHE, texte noir (`--cta-primary-*`) — l'action
 *   principale de l'écran, une seule.
 * - `glass` : la pilule de verre ; au focus elle devient blanche, texte noir,
 *   comme sur Apple TV — c'est le changement de matière qui dit « ici ».
 *
 * Au focus : agrandissement et soulèvement, jamais d'anneau.
 * `progress` (0 à 1) ajoute la jauge d'un « Reprendre ».
 */

export interface PillButtonProps {
  label: string;
  icon?: IconName;
  variant?: "primary" | "glass";
  size?: "lg" | "md";
  progress?: number;
  focusKey?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const SIZES = {
  lg: { height: 68, padX: 36, text: 26, icon: 26, gap: 12 },
  md: { height: 56, padX: 28, text: 23, icon: 22, gap: 10 },
} as const;

function Content({ label, icon, color, size, progress, track, fill }: {
  label: string;
  icon?: IconName;
  color: string;
  size: (typeof SIZES)[keyof typeof SIZES];
  progress?: number;
  track: string;
  fill: string;
}) {
  return (
    <View style={[styles.row, { gap: size.gap, paddingHorizontal: size.padX, height: size.height }]}>
      {icon ? <Icon name={icon} size={size.icon} color={color} strokeWidth={2.4} /> : null}
      <Text style={[styles.label, { fontSize: size.text, color }]} numberOfLines={1}>{label}</Text>
      {progress !== undefined ? (
        <View style={[styles.track, { backgroundColor: track }]}>
          <View style={[styles.fill, { backgroundColor: fill, width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

export const PillButton = memo(function PillButton({
  label,
  icon,
  variant = "glass",
  size = "lg",
  progress,
  focusKey,
  onPress,
  onFocusChange,
}: PillButtonProps) {
  const s = SIZES[size];
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={label}>
      {(focused) => (
        <Body focused={focused} variant={variant} s={s} label={label} icon={icon} progress={progress} />
      )}
    </FocusTarget>
  );
});

function Body({ focused, variant, s, label, icon, progress }: {
  focused: boolean;
  variant: "primary" | "glass";
  s: (typeof SIZES)[keyof typeof SIZES];
  label: string;
  icon?: IconName;
  progress?: number;
}) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (TV_STAGE.focus.buttonScale - 1) * p.value }] }));
  const shadow = useAnimatedStyle(() => ({ opacity: p.value }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: variant === "primary" ? 1 : p.value }));
  const glassLayer = useAnimatedStyle(() => ({ opacity: variant === "primary" ? 0 : 1 - p.value }));
  const radius = s.height / 2;
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, { borderRadius: radius }, shadow]} />
      <Animated.View style={[StyleSheet.absoluteFill, glassLayer]}>
        <GlassSurface radius={radius} tone="clear" style={StyleSheet.absoluteFill} />
        <Content label={label} icon={icon} color={colors.text} size={s} progress={progress} track={white(0.3)} fill={colors.text} />
      </Animated.View>
      <Animated.View style={[{ borderRadius: radius, backgroundColor: colors.ctaBg }, whiteLayer]}>
        <Content label={label} icon={icon} color={colors.ctaFg} size={s} progress={progress} track={scrim(0.16)} fill={colors.ctaFg} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  label: { ...fonts.bold },
  track: { width: 84, height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  shadow: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
});
