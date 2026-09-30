import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { FocusTarget } from "../../focus/FocusTarget";
import { useFocusProgress } from "../../focus/useFocusProgress";
import { GlassSurface } from "../../glass/GlassSurface";
import { Icon, type IconName } from "../../icons/Icon";
import { colors, fonts } from "../../theme/tokens";
import { SOFT_BASE } from "./surfaces";

/**
 * Le bouton rond du lecteur : verre au repos, BLANC au focus (pictogramme
 * noir), agrandi et soulevé — jamais d'anneau.
 *
 * - `primary` : le disque blanc de Lecture/Pause, la seule action principale ;
 * - `seconds` : le chiffre d'un saut dans sa flèche circulaire (−10, +30) ;
 * - `caption` : le libellé paraît SOUS le bouton au focus (un rond ne dit pas
 *   ce qu'il fait) — éteint pour Fermer et Retour, que tout le monde lit.
 */

export interface CircleButtonProps {
  /** Libellé accessible, et légende au focus. */
  label: string;
  icon?: IconName;
  seconds?: { value: number; forward: boolean };
  size?: number;
  primary?: boolean;
  caption?: boolean;
  focusKey?: string;
  onPress?: () => void;
  onFocusChange?: (focused: boolean) => void;
}

export const CircleButton = memo(function CircleButton(props: CircleButtonProps) {
  return (
    <FocusTarget focusKey={props.focusKey} onPress={props.onPress} onFocusChange={props.onFocusChange} accessibilityLabel={props.label}>
      {(focused) => <Body {...props} focused={focused} />}
    </FocusTarget>
  );
});

function Glyph({ icon, seconds, size, color }: { icon?: IconName; seconds?: CircleButtonProps["seconds"]; size: number; color: string }) {
  if (seconds) {
    const glyph = Math.round(size * 0.66);
    return (
      <View style={[styles.center, { width: glyph, height: glyph }]}>
        <View style={StyleSheet.absoluteFill}>
          <Icon name={seconds.forward ? "forward" : "replay"} size={glyph} color={color} strokeWidth={1.7} />
        </View>
        <Text style={[styles.seconds, { color }]}>{seconds.value}</Text>
      </View>
    );
  }
  if (!icon) return null;
  // Le triangle de lecture a son centre optique à droite de sa boîte.
  const nudge = icon === "play" ? size * 0.035 : 0;
  return (
    <View style={{ transform: [{ translateX: nudge }] }}>
      <Icon name={icon} size={Math.round(size * 0.4)} color={color} strokeWidth={2.4} />
    </View>
  );
}

function Body({ label, icon, seconds, size = 80, primary = false, caption = true, focused }: CircleButtonProps & { focused: boolean }) {
  const p = useFocusProgress(focused);
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * p.value }, { scale: 1 + (primary ? 0.08 : 0.12) * p.value }],
  }));
  const shadow = useAnimatedStyle(() => ({ opacity: p.value }));
  const whiteLayer = useAnimatedStyle(() => ({ opacity: primary ? 1 : p.value }));
  const captionStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: 8 * (1 - p.value) }] }));
  const radius = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, lift]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.shadow, { borderRadius: radius }, shadow]} />
        {primary ? null : (
          <>
            <GlassSurface radius={radius} tone="clear" style={[StyleSheet.absoluteFill, styles.base]} />
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Glyph icon={icon} seconds={seconds} size={size} color={colors.text} />
            </View>
          </>
        )}
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, { borderRadius: radius, backgroundColor: colors.ctaBg }, whiteLayer]}>
          <Glyph icon={icon} seconds={seconds} size={size} color={colors.ctaFg} />
        </Animated.View>
      </Animated.View>
      {caption ? (
        <Animated.View pointerEvents="none" style={[styles.captionBox, { top: size + 18, left: size / 2 - CAPTION_WIDTH / 2 }, captionStyle]}>
          <Text style={styles.caption} numberOfLines={1}>{label}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const CAPTION_WIDTH = 360;

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  // Posé sur la vidéo : un fond voilé sous le verre garde le pictogramme lisible.
  base: { backgroundColor: SOFT_BASE },
  seconds: { ...fonts.bold, fontSize: 22, letterSpacing: -0.6, fontVariant: ["tabular-nums"], marginTop: 1 },
  shadow: {
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
  },
  captionBox: { position: "absolute", width: CAPTION_WIDTH, alignItems: "center" },
  caption: { ...fonts.semibold, fontSize: 24, color: colors.text },
});
