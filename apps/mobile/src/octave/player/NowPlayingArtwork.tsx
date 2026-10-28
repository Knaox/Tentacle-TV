/**
 * Octave (mobile) — la grande pochette du lecteur : elle se RÉTRÉCIT un peu en pause (le son s'est arrêté, la
 * pochette « recule »), se balaie de côté pour changer de titre (elle suit le doigt, sort, et la suivante entre
 * du côté opposé), et se tire vers le bas pour refermer le lecteur (`onDrag` / `onDragEnd`, tenus par la feuille).
 */

import { memo, useCallback, useMemo, useRef } from "react";
import { PanResponder, StyleSheet } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { haptic } from "@/utils/haptics";
import { PlayerArtwork } from "./PlayerArtwork";
import { useOctavePlayer, usePlayerSelector } from "./OctavePlayerContext";
import { decideSwipe, gestureAxis, rubberBand } from "./playerGestures";

interface Props {
  size: number;
  onDrag: (dy: number) => void;
  onDragEnd: (dy: number, vy: number) => void;
}

const SPRING = { damping: 18, stiffness: 220, mass: 0.9 } as const;
const BREATHE = { damping: 16, stiffness: 120, mass: 1 } as const;
/** La pochette en pause : elle recule, sans disparaître. */
const PAUSED_SCALE = 0.84;

export const NowPlayingArtwork = memo(function NowPlayingArtwork({ size, onDrag, onDragEnd }: Props) {
  const player = useOctavePlayer();
  const reduceMotion = useReducedMotion();
  const url = usePlayerSelector((s) => s.current?.artworkUrl ?? null);
  const playing = usePlayerSelector((s) => s.wantsPlay);
  const hasNext = usePlayerSelector((s) => s.queue.cursor < s.queue.items.length - 1 || s.queue.repeat !== "off");
  const offset = useSharedValue(0);
  const live = useRef({ size, hasNext, reduceMotion, onDrag, onDragEnd });
  live.current = { size, hasNext, reduceMotion, onDrag, onDragEnd };

  const change = useCallback((outcome: "next" | "previous") => {
    haptic("select");
    if (outcome === "next") player.next();
    else player.previous();
  }, [player]);

  const responder = useMemo(() => {
    let axis: "horizontal" | "vertical" | null = null;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => gestureAxis(g.dx, g.dy) !== null,
      onPanResponderGrant: () => {
        axis = null;
      },
      onPanResponderMove: (_e, g) => {
        axis ??= gestureAxis(g.dx, g.dy);
        if (axis === "horizontal") offset.value = rubberBand(g.dx, g.dx > 0 || live.current.hasNext);
        else if (axis === "vertical") live.current.onDrag(g.dy);
      },
      onPanResponderRelease: (_e, g) => {
        const { size: width, hasNext: canNext, reduceMotion: still } = live.current;
        if (axis === "vertical") {
          live.current.onDragEnd(g.dy, g.vy);
          return;
        }
        const outcome = decideSwipe(g.dx, g.vx, width);
        const allowed = outcome === "previous" || (outcome === "next" && canNext);
        if (outcome === "stay" || !allowed || still) {
          offset.value = withSpring(0, SPRING);
          if (outcome !== "stay" && allowed) change(outcome);
          return;
        }
        const out = (outcome === "next" ? -1 : 1) * width * 1.15;
        offset.value = withTiming(out, { duration: 170 }, (done) => {
          if (!done) return;
          runOnJS(change)(outcome);
          offset.value = -out;
          offset.value = withSpring(0, SPRING);
        });
      },
      onPanResponderTerminate: () => {
        offset.value = withSpring(0, SPRING);
        if (axis === "vertical") live.current.onDragEnd(0, 0);
      },
    });
  }, [offset, change]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      // En lecture la pochette s'avance, en pause elle recule — un ressort plus lent que le geste : elle respire.
      { scale: reduceMotion ? withTiming(playing ? 1 : PAUSED_SCALE, { duration: 120 }) : withSpring(playing ? 1 : PAUSED_SCALE, BREATHE) },
      { rotateZ: `${(offset.value / Math.max(1, size)) * -4}deg` },
    ],
  }), [playing, size, reduceMotion]);

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }, style]} {...responder.panHandlers}>
      <PlayerArtwork url={url} size={size} radius={Math.round(size * 0.05) + 6} crossfade />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 14 },
});
