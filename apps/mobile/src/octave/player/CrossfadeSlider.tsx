/**
 * Octave (mobile) — la RÉGLETTE de la transition douce : douze crans (coupée, puis 2 → 12 s, `CROSSFADE_STOPS_S`),
 * un point par cran, le dégradé de la marque jusqu'au curseur. On glisse ou on touche ; le curseur se cale sur
 * le cran le plus proche, avec un petit retour haptique à chaque cran franchi. Accessibilité : un ajustable,
 * un cran par geste.
 */

import { memo, useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { haptic } from "@/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { CROSSFADE_STOPS_S, crossfadeAtPosition, crossfadePosition, crossfadeStep } from "@tentacle-tv/shared/octave";
import { useOctaveColors } from "../theme/octaveColors";

const THUMB = 24;

interface Props {
  ms: number;
  onChange: (ms: number) => void;
}

export const CrossfadeSlider = memo(function CrossfadeSlider({ ms, onChange }: Props) {
  const { t } = useTranslation("octaveShell");
  const colors = useOctaveColors();
  const [width, setWidth] = useState(0);
  const live = useRef({ width, ms, onChange });
  live.current = { width, ms, onChange };

  const responder = useMemo(() => {
    const pick = (x: number) => {
      const { width: w, ms: current, onChange: change } = live.current;
      const usable = Math.max(1, w - THUMB);
      const next = crossfadeAtPosition((x - THUMB / 2) / usable);
      if (next === current) return;
      haptic("select");
      change(next);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => pick(e.nativeEvent.locationX),
      onPanResponderMove: (e) => pick(e.nativeEvent.locationX),
    });
  }, []);

  const position = crossfadePosition(ms);
  const usable = Math.max(0, width - THUMB);
  const thumbX = position * usable;
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(thumbX, { damping: 18, stiffness: 320 }) }] }), [thumbX]);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const label = ms > 0 ? t("crossfade.seconds", { count: ms / 1000 }) : t("crossfade.off");

  return (
    <View>
      <View
        onLayout={onLayout}
        style={styles.touch}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t("crossfade.duration")}
        accessibilityValue={{ text: label }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => onChange(crossfadeStep(ms, e.nativeEvent.actionName === "increment" ? 1 : -1))}
      >
        <View pointerEvents="none" style={[styles.track, { left: THUMB / 2, right: THUMB / 2, backgroundColor: colors.line }]}>
          <View style={[styles.fill, { width: thumbX }]}>
            <LinearGradient colors={[colors.gradient[0], colors.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </View>
        </View>
        {width > 0 && CROSSFADE_STOPS_S.map((s, i) => (
          <View
            key={s}
            pointerEvents="none"
            style={[
              styles.dot,
              { left: THUMB / 2 + (i / (CROSSFADE_STOPS_S.length - 1)) * usable - 2, backgroundColor: i / (CROSSFADE_STOPS_S.length - 1) <= position ? "rgba(255,255,255,0.9)" : colors.textTertiary },
            ]}
          />
        ))}
        <Animated.View pointerEvents="none" style={[styles.thumb, { backgroundColor: colors.text, shadowColor: colors.gradient[1] }, thumbStyle]} />
      </View>
      <View style={styles.scale} pointerEvents="none">
        <Text style={[styles.scaleText, { color: ms === 0 ? colors.accentText : colors.textTertiary }]}>{t("crossfade.off")}</Text>
        <Text style={[styles.scaleText, { color: colors.textTertiary }]}>{t("crossfade.seconds", { count: 12 })}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  touch: { height: 44, justifyContent: "center" },
  track: { position: "absolute", height: 6, borderRadius: 3, overflow: "hidden", top: 19 },
  fill: { height: 6 },
  dot: { position: "absolute", width: 4, height: 4, borderRadius: 2, top: 20 },
  thumb: { position: "absolute", left: 0, top: 10, width: THUMB, height: THUMB, borderRadius: THUMB / 2, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  scale: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  scaleText: { fontSize: 11, fontWeight: "600" },
});
