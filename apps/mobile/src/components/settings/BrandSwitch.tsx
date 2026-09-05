import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ctlGradient, motion, useTheme, useThemedStyles, withAlpha, type AppTheme } from "@/theme";

let Haptics: { selectionAsync?: () => void } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* optionnel */ }

const TRACK_W = 44;
const TRACK_H = 24;
const THUMB = 20;
const THUMB_TRAVEL = TRACK_W - THUMB - 4;
const TOGGLE_MS = 200;

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

/**
 * L'interrupteur du web (`.ctl-switch`), au pixel : piste de verre au repos,
 * dégradé signature violet → rose quand il est allumé, pouce blanc ombré.
 * Un `Switch` natif ne sait peindre qu'un aplat — et sa forme change d'une
 * plateforme à l'autre. Ici, un seul calque de dégradé dont l'OPACITÉ suit
 * l'état, le pouce en `translateX` : rien d'autre ne bouge. Cible de 44 pt
 * par `hitSlop`, rôle « switch » et état lus par les lecteurs d'écran.
 */
export function BrandSwitch({ value, onValueChange, disabled, accessibilityLabel }: Props) {
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const gradient = ctlGradient(theme.colors.brand);

  const on = useSharedValue(value ? 1 : 0);
  const pressed = useSharedValue(1);
  useEffect(() => {
    on.value = withTiming(value ? 1 : 0, { duration: motion.respectReducedMotion(TOGGLE_MS) });
  }, [value, on]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: on.value }));
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: 2 + on.value * THUMB_TRAVEL }] }));
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));

  const toggle = () => {
    Haptics?.selectionAsync?.();
    onValueChange(!value);
  };

  return (
    <Pressable
      onPress={toggle}
      onPressIn={() => { pressed.value = withSpring(0.94, { damping: 18, stiffness: 320 }); }}
      onPressOut={() => { pressed.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
      disabled={disabled}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
    >
      <Animated.View style={[st.track, disabled && st.disabled, pressStyle]}>
        {/* Le calque allumé : dégradé + lueur, toujours monté (Fabric Android
            perd le rayon d'une vue créée à la volée avec son seul fond). */}
        <Animated.View style={[st.fill, fillStyle]} collapsable={false}>
          <LinearGradient
            colors={gradient.colors}
            locations={gradient.locations}
            start={gradient.start}
            end={gradient.end}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[st.thumb, thumbStyle]} />
        <View pointerEvents="none" style={st.ring} />
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: 999,
    backgroundColor: t.colors.fill.strong,
    justifyContent: "center" as const,
  },
  disabled: { opacity: 0.4 },
  // Allumé : dégradé, liseré de marque et lueur (`--ctl-glow`), le tout
  // dans un calque dont seule l'opacité change.
  fill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: withAlpha(t.colors.brand.violet, 0.45, t.colors.brand.glow),
    shadowColor: t.colors.brand.violet,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  // Au repos : hairline neutre, comme la piste de verre du web.
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border.subtle,
  },
  thumb: {
    position: "absolute" as const,
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
    elevation: 2,
  },
});
