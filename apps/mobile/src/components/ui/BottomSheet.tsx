import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import {
  Animated, Dimensions, Modal, PanResponder, Pressable, StyleSheet, View,
  type GestureResponderEvent, type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { SURFACE, BORDER, RADIUS, SHADOW_RN } from "@/theme";

const SCREEN_H = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 80;
const HANDLE_H = 24; // paddingTop(12) + paddingBottom(8) + bar(4)

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoints?: [number, number];
  children: ReactNode;
}

/**
 * Bottom sheet Netflix-style — drag handle slim, BlurView backdrop, surface
 * SURFACE.s1 avec border-top subtle, animation spring damping/stiffness pour
 * un feel naturel. APIs préservées : visible / onClose / snapPoints / children.
 */
export function BottomSheet({ visible, onClose, snapPoints = [0.5, 1.0], children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const snapHeights = snapPoints.map((p) => Math.round(SCREEN_H * p));
  const [minH, maxH] = snapHeights;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  // Ref bag — PanResponder lit toujours des valeurs fraîches
  const ref = useRef({ currentSnap: 0, minH, maxH, onClose });
  ref.current.minH = minH;
  ref.current.maxH = maxH;
  ref.current.onClose = onClose;

  const animateTo = useCallback((toValue: number, onDone?: () => void) => {
    Animated.spring(translateY, {
      toValue, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
    } as Animated.SpringAnimationConfig).start(onDone);
  }, [translateY]);

  const dismiss = useCallback(() => {
    setIsExpanded(false);
    ref.current.currentSnap = 0;
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: SCREEN_H, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
      } as Animated.SpringAnimationConfig),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => ref.current.onClose());
  }, [translateY, overlayOpacity]);

  const prevVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible) {
      ref.current.currentSnap = 0;
      setIsExpanded(false);
      translateY.setValue(SCREEN_H);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SCREEN_H - minH, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
        } as Animated.SpringAnimationConfig),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else if (visible && wasVisible) {
      ref.current.currentSnap = 0;
      setIsExpanded(false);
      animateTo(SCREEN_H - minH);
    } else if (!visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: SCREEN_H, useNativeDriver: true, damping: 22, stiffness: 240, mass: 0.9,
        } as Animated.SpringAnimationConfig),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateY, overlayOpacity, minH, animateTo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) => Math.abs(g.dy) > 5,
      onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const { currentSnap, minH: mH, maxH: xH } = ref.current;
        const base = currentSnap === 0 ? SCREEN_H - mH : SCREEN_H - xH;
        const next = Math.max(SCREEN_H - xH, base + g.dy);
        translateY.setValue(next);
      },
      onPanResponderRelease: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        const { currentSnap, minH: mH, maxH: xH } = ref.current;

        if (g.dy > DISMISS_THRESHOLD && currentSnap === 0) { setIsExpanded(false); dismiss(); return; }
        if (g.dy > DISMISS_THRESHOLD && currentSnap === 1) {
          ref.current.currentSnap = 0; setIsExpanded(false);
          animateTo(SCREEN_H - mH); return;
        }
        if (g.dy < -DISMISS_THRESHOLD && currentSnap === 0) {
          ref.current.currentSnap = 1; setIsExpanded(true);
          animateTo(SCREEN_H - xH); return;
        }

        const snapTo = currentSnap === 0 ? SCREEN_H - mH : SCREEN_H - xH;
        animateTo(snapTo);
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Backdrop: blur + scrim */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "rgba(0,0,0,0.55)" }]} />
          <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel="Fermer" />
        </Animated.View>

        {/* Sheet panel */}
        <Animated.View
          style={[
            styles.sheet,
            SHADOW_RN.sheet,
            {
              height: maxH,
              backgroundColor: SURFACE.s1,
              transform: [{ translateY }],
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {isExpanded && <View style={{ height: insets.top }} />}

          {/* Drag handle area (gesture target) */}
          <View {...panResponder.panHandlers} style={styles.handleArea}>
            <View style={styles.handle} />
          </View>

          <View
            style={{
              flex: 1,
              maxHeight: (isExpanded ? maxH : minH) - HANDLE_H - (isExpanded ? insets.top : 0) - insets.bottom,
            }}
          >
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
  },
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: RADIUS["2xl"],
    borderTopRightRadius: RADIUS["2xl"],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER.subtle,
  },
  handleArea: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.28)",
    borderRadius: 2,
  },
});
