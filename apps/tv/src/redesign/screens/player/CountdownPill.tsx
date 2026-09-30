import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts, scrim, white } from "../../theme/tokens";
import type { Countdown } from "./playerTypes";

/**
 * La pilule d'une action qui peut partir toute seule : « Passer l'intro dans
 * 5 s », « Lire maintenant ». Même matière que `PillButton` (verre → blanc au
 * focus, ou blanche d'emblée), plus l'ANNEAU ambre du décompte autour de son
 * pictogramme — la seule touche de couleur, qui se remplit à mesure que le
 * temps passe. Le décompte est une valeur reçue : rien ne tourne ici.
 */

export interface CountdownPillProps {
  label: string;
  icon: IconName;
  variant?: "primary" | "glass";
  countdown?: Countdown | null;
  /** Un fond sous le verre, quand la pilule flotte sur l'image. */
  base?: string;
  focusKey?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

const HEIGHT = 68;
const RING = 42;
const STROKE = 4;

/** L'anneau du décompte : la part écoulée, en arc qui part de midi. */
export function CountdownRing({ countdown, track, fill, size = RING }: { countdown: Countdown; track: string; fill: string; size?: number }) {
  const r = (size - STROKE) / 2;
  const c = 2 * Math.PI * r;
  const elapsed = countdown.total > 0 ? Math.min(1, Math.max(0, 1 - countdown.remaining / countdown.total)) : 0;
  return (
    <Svg width={size} height={size} style={styles.ring}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={fill}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - Math.max(0.02, elapsed))}
        fill="none"
      />
    </Svg>
  );
}

function Content({ label, icon, countdown, dark }: { label: string; icon: IconName; countdown?: Countdown | null; dark: boolean }) {
  const color = dark ? colors.ctaFg : colors.text;
  return (
    <View style={styles.row}>
      <View style={styles.lead}>
        {countdown ? (
          <CountdownRing countdown={countdown} track={dark ? scrim(0.14) : white(0.28)} fill={dark ? colors.accentDeep : colors.accent} />
        ) : null}
        <Icon name={icon} size={countdown ? 18 : 26} color={color} strokeWidth={2.4} />
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export const CountdownPill = memo(function CountdownPill({
  label,
  icon,
  variant = "glass",
  countdown,
  base,
  focusKey,
  onPress,
  onFocusChange,
}: CountdownPillProps) {
  return (
    <FocusTarget focusKey={focusKey} onPress={onPress} onFocusChange={onFocusChange} accessibilityLabel={label}>
      {(focused) => <Body focused={focused} label={label} icon={icon} variant={variant} countdown={countdown} base={base} />}
    </FocusTarget>
  );
});

function Body({ focused, label, icon, variant, countdown, base }: {
  focused: boolean;
  label: string;
  icon: IconName;
  variant: "primary" | "glass";
  countdown?: Countdown | null;
  base?: string;
}) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (TV_STAGE.focus.buttonScale - 1) * p.value }] }));
  const shadow = useAnimatedStyle(() => ({ opacity: p.value }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: variant === "primary" ? 1 : p.value }));
  const glassLayer = useAnimatedStyle(() => ({ opacity: variant === "primary" ? 0 : 1 - p.value }));
  return (
    <Animated.View style={lift}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, shadow]} />
      <Animated.View style={[StyleSheet.absoluteFill, glassLayer]}>
        <GlassSurface radius={HEIGHT / 2} tone="clear" style={[StyleSheet.absoluteFill, base ? { backgroundColor: base } : null]} />
        <Content label={label} icon={icon} countdown={countdown} dark={false} />
      </Animated.View>
      <Animated.View style={[styles.white, whiteLayer]}>
        <Content label={label} icon={icon} countdown={countdown} dark />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14, height: HEIGHT, paddingLeft: 16, paddingRight: 36 },
  lead: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", transform: [{ rotate: "-90deg" }] },
  label: { ...fonts.bold, fontSize: 26 },
  white: { borderRadius: HEIGHT / 2, backgroundColor: colors.ctaBg },
  shadow: {
    borderRadius: HEIGHT / 2,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
  },
});
