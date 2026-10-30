/**
 * Octave (mobile) — la barre de position du lecteur : une piste fine qui s'épaissit sous le doigt (zone tactile
 * de 44 pt), le temps écoulé et la durée en chiffres tabulaires. On glisse n'importe où sur la piste ; le saut
 * part au LÂCHER (pas une requête par pixel). Accessibilité : un ajustable, ±10 s par geste.
 */

import { memo, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useOctavePlayer, usePlayerPosition } from "./OctavePlayerContext";
import { playedFraction } from "./ProgressLine";
import { useOctaveColors } from "../theme/octaveColors";

/** « 3:07 », « 1:02:45 ». */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export const SeekBar = memo(function SeekBar() {
  const { t } = useTranslation("music");
  const colors = useOctaveColors();
  const player = useOctavePlayer();
  const { positionMs, durationMs } = usePlayerPosition();
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const live = useRef({ width, durationMs });
  live.current = { width, durationMs };

  const responder = useMemo(() => {
    const at = (x: number) => {
      const { width: w, durationMs: d } = live.current;
      return w > 0 && d ? Math.min(1, Math.max(0, x / w)) * d : 0;
    };
    // Le point d'appui (dans la piste), puis le DÉPLACEMENT du doigt : `locationX` d'un mouvement se rapporte à la
    // vue sous le doigt du moment et saute quand il quitte la piste — la barre partait à côté du doigt (lot « fl »).
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        startX = e.nativeEvent.locationX;
        setScrub(at(startX));
      },
      onPanResponderMove: (_e, g) => setScrub(at(startX + g.dx)),
      onPanResponderRelease: (_e, g) => {
        player.seek(at(startX + g.dx));
        setScrub(null);
      },
      onPanResponderTerminate: () => setScrub(null),
    });
  }, [player]);

  const shown = scrub ?? positionMs;
  const fraction = playedFraction(shown, durationMs);
  const active = scrub !== null;
  const trackStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: withTiming(active ? 2 : 1, { duration: 140 }) }] }), [active]);
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ scale: withTiming(active ? 1.35 : 1, { duration: 140 }) }] }), [active]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const remaining = durationMs === null ? null : Math.max(0, durationMs - shown);

  return (
    <View>
      <View
        style={styles.touch}
        onLayout={onLayout}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("player.seek")}
        accessibilityValue={{ text: `${formatClock(shown)} / ${formatClock(durationMs ?? 0)}` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => player.seek(positionMs + (e.nativeEvent.actionName === "increment" ? 10_000 : -10_000))}
      >
        <Animated.View pointerEvents="none" style={[styles.track, { backgroundColor: colors.line }, trackStyle]}>
          <View style={[styles.fill, { width: `${fraction * 100}%` }]}>
            <LinearGradient colors={[colors.gradient[0], colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.thumb, { left: fraction * width - 7, backgroundColor: colors.text }, thumbStyle]} />
      </View>
      <View style={styles.times}>
        <Text style={[styles.time, { color: colors.textSecondary }]}>{formatClock(shown)}</Text>
        <Text style={[styles.time, { color: colors.textSecondary }]}>{remaining === null ? "" : `-${formatClock(remaining)}`}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  touch: { height: 44, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4 },
  thumb: { position: "absolute", width: 14, height: 14, borderRadius: 7, top: 15 },
  times: { flexDirection: "row", justifyContent: "space-between", marginTop: -6 },
  time: { fontSize: 12, fontVariant: ["tabular-nums"] },
});
