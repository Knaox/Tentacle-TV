import { memo, useEffect, useState } from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { STILL_WATCHING_TV_KEYS } from "@tentacle-tv/tv-core";
import { TV_MOTION, TV_STAGE } from "@tentacle-tv/theme";
import { BrandGradient } from "../../brand/BrandGradient";
import { PillButton } from "../../controls/PillButton";
import { FocusGroup } from "../../focus/FocusGroup";
import { GlassSurface } from "../../glass/GlassSurface";
import { useNativeGlassBacking } from "../../glass/glassBacking";
import { Icon } from "../../icons/Icon";
import { useOverlayArrival } from "../../motion/useOverlayArrival";
import { brandTint, colors, fonts, white } from "../../theme/tokens";
import type { StillWatchingModel } from "./playerTypes";
import { DENSE_BASE } from "./surfaces";

/**
 * « Vous regardez encore ? » — l'encart du lecteur TV, en bas à droite, À LA
 * PLACE de la pilule de saut et de la carte « À suivre » (même coin, même
 * verre dense, même entrée en glissant). Deux états : la question, son
 * décompte et la barre de marque qui se vide ; puis « Lecture en pause » et
 * « Reprendre ».
 *
 * Clés : `stillwatching:continue`, `stillwatching:pause`,
 * `stillwatching:resume` (tv-core `STILL_WATCHING_TV_KEYS`) ; groupe
 * `stillwatching:actions`, qui retient le focus. Qui le prend, ce que font
 * les touches : l'intégration (tv-core `stillWatchingTv`).
 */

const SAFE = TV_STAGE.safe;

export const StillWatchingCard = memo(function StillWatchingCard({
  model,
  onContinue,
  onPause,
  onResume,
}: {
  model: StillWatchingModel;
  onContinue?: () => void;
  onPause?: () => void;
  onResume?: () => void;
}) {
  const backing = useNativeGlassBacking("strong");
  // Elle entre en glissant depuis le bord droit (Apple TV), comme « À suivre ».
  const { body } = useOverlayArrival("x", TV_MOTION.player.panelSlide);
  const asking = model.phase === "asking";
  // Le lecteur d'écran dit le changement d'état, une fois — le focus, lui, se pose sans voix.
  useEffect(() => { AccessibilityInfo.announceForAccessibility(model.title); }, [model.title]);

  return (
    <Animated.View style={[styles.anchor, body]} pointerEvents="box-none">
      <GlassSurface radius={36} tone="strong" elevated style={[styles.card, backing]}>
        <View style={styles.top}>
          <View style={styles.badge}>
            <Icon name={asking ? "clock" : "pause"} size={30} color={colors.accentLight} strokeWidth={2.4} />
          </View>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={2}>{model.title}</Text>
            <Text style={styles.body} numberOfLines={3}>{model.body}</Text>
          </View>
        </View>
        {asking ? <CountdownBar remainingMs={model.remainingMs} totalMs={model.totalMs} /> : null}
        <FocusGroup focusKey="stillwatching:actions" style={styles.actions}>
          {asking ? (
            <>
              <PillButton variant="brand" icon="play" label={model.continueLabel} focusKey={STILL_WATCHING_TV_KEYS.continue} onPress={onContinue} />
              <PillButton variant="glass" icon="pause" label={model.pauseLabel} focusKey={STILL_WATCHING_TV_KEYS.pause} onPress={onPause} />
            </>
          ) : (
            <PillButton variant="brand" icon="play" label={model.resumeLabel} focusKey={STILL_WATCHING_TV_KEYS.resume} onPress={onResume} />
          )}
        </FocusGroup>
      </GlassSurface>
    </Animated.View>
  );
});

/**
 * La barre du décompte : le dégradé de marque qui se VIDE en `scaleX`, UNE
 * animation linéaire armée au montage sur le temps qui reste — jamais une
 * largeur recalculée à chaque battement. Elle part donc du vrai reste, et
 * touche zéro à l'instant de la pause. Sous « Réduire les animations », elle
 * s'efface : la phrase décompte en toutes lettres.
 */
function CountdownBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const reduced = useReducedMotion();
  const [armed] = useState(() => ({
    fraction: totalMs > 0 ? Math.min(1, Math.max(0, remainingMs / totalMs)) : 0,
    durationMs: Math.max(0, remainingMs),
  }));
  const scale = useSharedValue(armed.fraction);
  useEffect(() => {
    scale.value = withTiming(0, { duration: armed.durationMs, easing: Easing.linear });
    return () => cancelAnimation(scale);
  }, [armed, scale]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.value }] }));
  if (reduced) return null;
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fill]}>
        <BrandGradient />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: "absolute", right: SAFE.x, bottom: SAFE.y },
  card: { width: 760, padding: 30, gap: 24, backgroundColor: DENSE_BASE },
  top: { flexDirection: "row", gap: 22, alignItems: "flex-start" },
  badge: {
    width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: brandTint(0.2),
  },
  text: { flex: 1, gap: 8 },
  title: { ...fonts.bold, fontSize: 32, lineHeight: 38, color: colors.text },
  body: { ...fonts.regular, fontSize: 24, lineHeight: 32, color: white(0.72) },
  track: { height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: white(0.14) },
  fill: { ...StyleSheet.absoluteFillObject, borderRadius: 3, overflow: "hidden", transformOrigin: "left" },
  actions: { flexDirection: "row", gap: 18 },
});
