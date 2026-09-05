import { useEffect, useRef, useState } from "react";
import { View, Text, PanResponder, StyleSheet, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { IconButton } from "@/components/ui";
import { spacing, typography, FONT_FAMILY, motion, useThemedStyles, type AppTheme } from "@/theme";

let Haptics: { selectionAsync?: () => void } | null = null;
try { Haptics = require("expo-haptics"); } catch { /* optionnel */ }

const THUMB = 28;
const TRACK_H = 6;

interface Props {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** À chaque cran (état local du parent). */
  onChange: (value: number) => void;
  /** Au relâcher ou après ± : le moment de sauvegarder. */
  onChangeEnd?: (value: number) => void;
  accessibilityLabel: string;
  /** « 40 sur 100 » — lu par les lecteurs d'écran et affiché sous la piste. */
  valueText: string;
  leftLabel: string;
  rightLabel: string;
}

/**
 * Un curseur à crans sans dépendance native : une piste de 44 pt (tap et
 * glissé, un PanResponder), des boutons − / + et le rôle « ajustable » pour
 * les lecteurs d'écran (geste haut/bas = un cran). Le curseur ne bouge qu'en
 * `transform`, jamais en layout ; sec en mouvement réduit.
 */
export function SteppedSlider({
  value, min = 0, max = 100, step = 10, onChange, onChangeEnd,
  accessibilityLabel, valueText, leftLabel, rightLabel,
}: Props) {
  const st = useThemedStyles(makeStyles);
  const [trackW, setTrackW] = useState(0);
  const steps = Math.max(1, Math.round((max - min) / step));
  const snap = (v: number) => Math.min(max, Math.max(min, Math.round((v - min) / step) * step + min));
  const ratio = max > min ? (value - min) / (max - min) : 0;

  const x = useSharedValue(ratio * trackW);
  useEffect(() => {
    x.value = withTiming(ratio * trackW, { duration: motion.respectReducedMotion(120) });
  }, [ratio, trackW, x]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - THUMB / 2 }] }));

  // Le PanResponder est créé une fois : il lit des refs, toujours fraîches.
  const ref = useRef({ trackW, value, onChange, onChangeEnd, min, max, step });
  Object.assign(ref.current, { trackW, value, onChange, onChangeEnd, min, max, step });
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: (e) => commit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => commit(e.nativeEvent.locationX),
      onPanResponderRelease: () => ref.current.onChangeEnd?.(ref.current.value),
      onPanResponderTerminate: () => ref.current.onChangeEnd?.(ref.current.value),
    }),
  ).current;

  function commit(px: number) {
    const r = ref.current;
    const w = Math.max(1, r.trackW);
    const raw = r.min + (Math.min(w, Math.max(0, px)) / w) * (r.max - r.min);
    const next = Math.min(r.max, Math.max(r.min, Math.round((raw - r.min) / r.step) * r.step + r.min));
    if (next === r.value) return;
    Haptics?.selectionAsync?.();
    r.onChange(next);
  }

  const nudge = (dir: 1 | -1) => {
    const next = snap(value + dir * step);
    if (next === value) return;
    onChange(next);
    onChangeEnd?.(next);
  };

  return (
    <View>
      <View style={st.row}>
        <IconButton icon="minus" size={36} onPress={() => nudge(-1)} accessibilityLabel={`${leftLabel} (−${step})`} />
        <View
          style={st.trackHit}
          onLayout={(e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min, max, now: value, text: valueText }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
          {...pan.panHandlers}
        >
          <View style={st.track} />
          <LinearGradient
            colors={[st.fillStart.color as string, st.fillEnd.color as string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[st.fill, { width: ratio * trackW }]}
          />
          {Array.from({ length: steps + 1 }, (_, i) => (
            <View key={i} style={[st.tick, { left: (i / steps) * trackW - 1 }]} />
          ))}
          <Animated.View style={[st.thumb, thumbStyle]} pointerEvents="none" />
        </View>
        <IconButton icon="plus" size={36} onPress={() => nudge(1)} accessibilityLabel={`${rightLabel} (+${step})`} />
      </View>
      <View style={st.labels}>
        <Text style={st.sideLabel}>{leftLabel}</Text>
        <Text style={st.valueLabel}>{valueText}</Text>
        <Text style={[st.sideLabel, st.rightLabel]}>{rightLabel}</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  row: { flexDirection: "row" as const, alignItems: "center" as const, gap: spacing.sm },
  trackHit: { flex: 1, height: 44, justifyContent: "center" as const },
  track: { height: TRACK_H, borderRadius: TRACK_H / 2, backgroundColor: t.colors.fill.medium },
  fill: { position: "absolute" as const, left: 0, height: TRACK_H, borderRadius: TRACK_H / 2 },
  fillStart: { color: t.colors.brand.violet },
  fillEnd: { color: t.colors.brand.accent },
  tick: { position: "absolute" as const, width: 2, height: 2, borderRadius: 1, backgroundColor: t.colors.text.quaternary, top: 22 - 1 },
  thumb: {
    position: "absolute" as const, left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: t.colors.cta.primaryBg, borderWidth: 2, borderColor: t.colors.brand.violet,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3,
  },
  labels: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, marginTop: 2, paddingHorizontal: 44 },
  sideLabel: { ...typography.small, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, flex: 1 },
  rightLabel: { textAlign: "right" as const },
  valueLabel: { ...typography.small, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
});
