/**
 * Octave (mobile) — le LECTEUR PLEIN ÉCRAN, en recouvrement de la coquille : il monte du bas (ressort), se
 * tire vers le bas pour se refermer (poignée, en-tête ou pochette), et Retour (Android) le referme. Le décor
 * est la pochette floutée sous un voile d'encre. Téléphone : en colonne ; tablette ou paysage : la pochette à
 * gauche, les commandes et la file à droite (`NowPlayingBody`). Monté seulement ouvert : fermé, il ne coûte rien.
 */

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { PlayerArtwork } from "./PlayerArtwork";
import { NowPlayingBody } from "./NowPlayingBody";
import { usePlayerSelector } from "./OctavePlayerContext";
import { closeNowPlaying, useNowPlayingOpen } from "./nowPlayingStore";
import { decideDismiss, gestureAxis, sheetDragOffset } from "./playerGestures";
import { useOctaveColors } from "../theme/octaveColors";
import { withAlpha } from "@/theme";

const OPEN_SPRING = { damping: 24, stiffness: 210, mass: 1 } as const;

export const NowPlayingSheet = memo(function NowPlayingSheet() {
  const open = useNowPlayingOpen();
  const hasTrack = usePlayerSelector((s) => s.current !== null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (open && hasTrack) setMounted(true);
    if (open && !hasTrack) closeNowPlaying();
  }, [open, hasTrack]);
  if (!mounted) return null;
  return <SheetFrame open={open && hasTrack} onClosed={() => setMounted(false)} />;
});

const SheetFrame = memo(function SheetFrame({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const colors = useOctaveColors();
  const { height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const translateY = useSharedValue(height);
  const url = usePlayerSelector((s) => s.current?.artworkUrl ?? null);

  useEffect(() => {
    if (open) translateY.value = reduceMotion ? withTiming(0, { duration: 160 }) : withSpring(0, OPEN_SPRING);
    else translateY.value = withTiming(height, { duration: 230 }, (done) => {
      if (done) runOnJS(onClosed)();
    });
  }, [open, height, reduceMotion, translateY, onClosed]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeNowPlaying();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const onDrag = useCallback((dy: number) => {
    translateY.value = sheetDragOffset(dy);
  }, [translateY]);
  const onDragEnd = useCallback((dy: number, vy: number) => {
    if (decideDismiss(dy, vy)) closeNowPlaying();
    else translateY.value = withSpring(0, OPEN_SPRING);
  }, [translateY]);

  // L'en-tête (poignée comprise) prend tout glissement vertical vers le bas.
  const headerResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => gestureAxis(g.dx, g.dy) === "vertical" && g.dy > 0,
    onPanResponderMove: (_e, g) => onDrag(g.dy),
    onPanResponderRelease: (_e, g) => onDragEnd(g.dy, g.vy),
    onPanResponderTerminate: () => onDragEnd(0, 0),
  }), [onDrag, onDragEnd]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    borderRadius: translateY.value > 1 ? 28 : 0,
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, 1 - translateY.value / Math.max(1, height)) * 0.6 }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.sheet, { backgroundColor: colors.ink }, sheetStyle]} accessibilityViewIsModal>
        <PlayerArtwork url={url} radius={0} style={StyleSheet.absoluteFill} blurRadius={50} />
        <LinearGradient
          colors={[withAlpha(colors.ink, 0.5, colors.ink), withAlpha(colors.ink, 0.78, colors.ink), colors.ink]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <NowPlayingBody headerHandlers={headerResponder.panHandlers} onDrag={onDrag} onDragEnd={onDragEnd} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  scrim: { backgroundColor: "#000" },
  sheet: { overflow: "hidden" },
});
