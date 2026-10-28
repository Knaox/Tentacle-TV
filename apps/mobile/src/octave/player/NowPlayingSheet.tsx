/**
 * Octave (mobile) — le LECTEUR PLEIN ÉCRAN, en recouvrement de la coquille : il NAÎT du mini-lecteur (même
 * place, même largeur, puis l'écran entier, `sheetTransition`) et y revient en se refermant ; il se tire vers
 * le bas pour se refermer (poignée, en-tête ou pochette), et Retour (Android) le referme. Le décor est le fond
 * vivant tiré de la pochette (`ambient/AmbientBackdrop`). Téléphone : en colonne ; tablette ou paysage : la pochette à
 * gauche, les commandes et la file à droite (`NowPlayingBody`). Monté seulement ouvert : fermé, il ne coûte rien.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, PanResponder, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackdrop } from "./ambient/AmbientBackdrop";
import { NowPlayingBody } from "./NowPlayingBody";
import { usePlayerSelector } from "./OctavePlayerContext";
import { closeNowPlaying, useNowPlayingOpen } from "./nowPlayingStore";
import { decideDismiss, gestureAxis, sheetDragOffset } from "./playerGestures";
import {
  CONTENT_FADE_RANGE, phoneMiniRect, rangeProgress, SHAPE_FADE_RANGE, SHEET_RADIUS, sheetFrame, sheetOrigin, tabletMiniRect, type SheetOrigin,
} from "./sheetTransition";
import { OCTAVE_MINI_GAP, useOctaveChrome } from "../shell/octaveChrome";

const OPEN_SPRING = { damping: 26, stiffness: 220, mass: 1 } as const;
/** La fermeture, plus brève que l'ouverture, sans rebond : la forme se pose sur la pastille. */
const CLOSE_TIMING = { duration: 300, easing: Easing.bezier(0.3, 0, 0.2, 1) } as const;

export const NowPlayingSheet = memo(function NowPlayingSheet() {
  const open = useNowPlayingOpen();
  const hasTrack = usePlayerSelector((s) => s.current !== null);
  const [mounted, setMounted] = useState(false);
  // Une page ouverte depuis le lecteur (« Voir l'album » du menu du titre) le referme, comme au bureau.
  const pathname = usePathname();
  const openedOn = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      openedOn.current = null;
      return;
    }
    if (openedOn.current === null) openedOn.current = pathname;
    else if (pathname !== openedOn.current) closeNowPlaying();
  }, [open, pathname]);
  useEffect(() => {
    if (open && hasTrack) setMounted(true);
    if (open && !hasTrack) closeNowPlaying();
  }, [open, hasTrack]);
  if (!mounted) return null;
  return <SheetFrame open={open && hasTrack} onClosed={() => setMounted(false)} />;
});

const SheetFrame = memo(function SheetFrame({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const origin = useMiniPlayerOrigin(width, height);
  // 0 : posé sur le mini-lecteur ; 1 : plein écran. `drag` : le doigt qui tire le lecteur vers le bas.
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);

  useEffect(() => {
    if (open) {
      progress.value = reduceMotion ? withTiming(1, { duration: 160 }) : withSpring(1, OPEN_SPRING);
      return;
    }
    const close = reduceMotion ? { duration: 160 } : CLOSE_TIMING;
    drag.value = withTiming(0, close);
    progress.value = withTiming(0, close, (done) => {
      if (done) runOnJS(onClosed)();
    });
  }, [open, reduceMotion, progress, drag, onClosed]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeNowPlaying();
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const onDrag = useCallback((dy: number) => {
    drag.value = sheetDragOffset(dy);
  }, [drag]);
  const onDragEnd = useCallback((dy: number, vy: number) => {
    if (decideDismiss(dy, vy)) closeNowPlaying();
    else drag.value = withSpring(0, OPEN_SPRING);
  }, [drag]);

  // L'en-tête (poignée comprise) prend tout glissement vertical vers le bas.
  const headerResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => gestureAxis(g.dx, g.dy) === "vertical" && g.dy > 0,
    onPanResponderMove: (_e, g) => onDrag(g.dy),
    onPanResponderRelease: (_e, g) => onDragEnd(g.dy, g.vy),
    onPanResponderTerminate: () => onDragEnd(0, 0),
  }), [onDrag, onDragEnd]);

  const sheetStyle = useAnimatedStyle(() => {
    const frame = sheetFrame(origin, progress.value);
    return {
      opacity: rangeProgress(progress.value, SHAPE_FADE_RANGE),
      transform: [{ translateX: frame.translateX }, { translateY: frame.translateY + drag.value }, { scaleX: frame.scaleX }],
      borderRadius: progress.value < 0.995 || drag.value > 1 ? SHEET_RADIUS : 0,
    };
  }, [origin]);
  const contentStyle = useAnimatedStyle(() => ({ opacity: rangeProgress(progress.value, CONTENT_FADE_RANGE) }));
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, progress.value) - drag.value / Math.max(1, height)) * 0.6,
  }), [height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? "auto" : "none"}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]} pointerEvents="none" />
      <Animated.View style={[StyleSheet.absoluteFill, styles.sheet, sheetStyle]} accessibilityViewIsModal>
        <AmbientBackdrop open={open} />
        <Animated.View style={[styles.fill, contentStyle]}>
          <NowPlayingBody headerHandlers={headerResponder.panHandlers} onDrag={onDrag} onDragEnd={onDragEnd} />
        </Animated.View>
      </Animated.View>
    </View>
  );
});

/** Où se tient le mini-lecteur, d'après ce que la coquille publie : le lecteur en part et y revient. */
function useMiniPlayerOrigin(width: number, height: number): SheetOrigin {
  const chrome = useOctaveChrome();
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const rect = chrome.layout === "phone"
      ? phoneMiniRect(width, height, chrome.tabBarHeight, chrome.miniPlayerHeight, OCTAVE_MINI_GAP)
      : tabletMiniRect(width, height, chrome.miniPlayerHeight, chrome.sidebarWidth, insets);
    return sheetOrigin(rect, width, height);
  }, [chrome.layout, chrome.tabBarHeight, chrome.miniPlayerHeight, chrome.sidebarWidth, insets, width, height]);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { backgroundColor: "#000" },
  sheet: { overflow: "hidden" },
});
