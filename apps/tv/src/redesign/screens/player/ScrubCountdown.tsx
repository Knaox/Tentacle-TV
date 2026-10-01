import { memo, useLayoutEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue,
} from "react-native-reanimated";
import { BrandGradient } from "../../brand/BrandGradient";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { MOTION_ENABLED } from "../../motion/motion";
import { colors, fonts, white } from "../../theme/tokens";
import type { ScrubCountdownModel } from "./playerTypes";
import { SOFT_BASE } from "./surfaces";

/**
 * Le DÉCOMPTE du défilement : ce qui se passera si l'on ne bouge plus, et
 * quand — « Lecture dans 3 s » (le doigt levé du pavé : la lecture repart à
 * la position visée), « Reprise à 12:34 dans 3 s » (l'abandon : on revient
 * au départ). Une pilule de verre discrète, posée au bas de la vignette,
 * juste au-dessus du temps visé et de l'écart ; sa barre, au dégradé de la
 * marque, se vide avec le temps.
 *
 * Le décompte est une valeur reçue (secondes restantes, sur combien) : rien
 * ne compte ici. `live` : la barre GLISSE d'une seconde à la suivante, sur le
 * fil d'interface (un `transform`) ; sans (banc), ou animations réduites,
 * elle se pose à la seconde. Rien n'y est focalisable.
 */

const HEIGHT = 56;
const PAD_X = 22;
const BAR = 3;

export const ScrubCountdown = memo(function ScrubCountdown({ model, appear }: {
  model: ScrubCountdownModel;
  /** 0 → 1 : son entrée, puis sa sortie (`Presented`) — un fondu, une montée. */
  appear?: SharedValue<number>;
}) {
  const { remaining, total } = model.countdown;
  const reduced = useReducedMotion();
  const fill = useSharedValue(total > 0 ? Math.min(1, remaining / total) : 0);
  const width = useSharedValue(0);
  useLayoutEffect(() => {
    const from = total > 0 ? Math.min(1, remaining / total) : 0;
    if (!model.live || reduced || !MOTION_ENABLED) {
      fill.value = from;
      return;
    }
    const to = total > 0 ? Math.max(0, remaining - 1) / total : 0;
    fill.value = withSequence(withTiming(from, { duration: 0 }), withTiming(to, { duration: 1000, easing: Easing.linear }));
  }, [remaining, total, model.live, reduced, fill]);
  const backing = useNativeGlassBacking("strong");
  const enter = useAnimatedStyle(() => {
    const p = appear ? appear.value : 1;
    return { opacity: p, transform: [{ translateY: 8 * (1 - p) }] };
  });
  const drain = useAnimatedStyle(() => ({ transform: [{ translateX: -(1 - fill.value) * width.value }] }));
  return (
    <Animated.View style={enter} pointerEvents="none" accessible accessibilityLabel={model.label}>
      <GlassSurface radius={HEIGHT / 2} tone="strong" style={[styles.pill, backing]}>
        <Icon name={model.kind === "play" ? "play" : "history"} size={22} color={colors.text} strokeWidth={2.4} />
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {model.label}
        </Text>
        <View style={styles.track} onLayout={(event) => { width.value = event.nativeEvent.layout.width; }}>
          <Animated.View style={[StyleSheet.absoluteFill, drain]}>
            <BrandGradient />
          </Animated.View>
        </View>
      </GlassSurface>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: HEIGHT,
    paddingHorizontal: PAD_X,
    paddingBottom: 6,
    backgroundColor: SOFT_BASE,
  },
  label: { ...fonts.semibold, fontSize: 24, color: colors.text, fontVariant: ["tabular-nums"], flexShrink: 1 },
  track: {
    position: "absolute",
    left: PAD_X,
    right: PAD_X,
    bottom: 10,
    height: BAR,
    borderRadius: BAR / 2,
    overflow: "hidden",
    backgroundColor: white(0.2),
  },
});
