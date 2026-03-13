import { useRef, useEffect, useCallback, useState, type ReactNode } from "react";
import {
  Animated, Dimensions, Modal, PanResponder, Pressable, View,
  type GestureResponderEvent, type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme";

const SCREEN_H = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 80;
const HANDLE_H = 20; // paddingTop(10) + paddingBottom(6) + bar(4)

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  snapPoints?: [number, number];
  children: ReactNode;
}

export function BottomSheet({ visible, onClose, snapPoints = [0.5, 1.0], children }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const snapHeights = snapPoints.map((p) => Math.round(SCREEN_H * p));
  const [minH, maxH] = snapHeights;
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  // Ref bag so PanResponder always reads fresh values
  const ref = useRef({ currentSnap: 0, minH, maxH, onClose });
  ref.current.minH = minH;
  ref.current.maxH = maxH;
  ref.current.onClose = onClose;

  const animateTo = useCallback((toValue: number, onDone?: () => void) => {
    Animated.spring(translateY, {
      toValue, useNativeDriver: true, damping: 20, stiffness: 200,
    }).start(onDone);
  }, [translateY]);

  const dismiss = useCallback(() => {
    setIsExpanded(false);
    ref.current.currentSnap = 0;
    Animated.parallel([
      Animated.spring(translateY, { toValue: SCREEN_H, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => ref.current.onClose());
  }, [translateY, overlayOpacity]);

  // Track previous visible state to distinguish open/close from snapPoint changes
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = visible;

    if (visible && !wasVisible) {
      // Opening: animate from bottom
      ref.current.currentSnap = 0;
      setIsExpanded(false);
      translateY.setValue(SCREEN_H);
      Animated.parallel([
        Animated.spring(translateY, { toValue: SCREEN_H - minH, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else if (visible && wasVisible) {
      // Already open, snapPoints changed — smoothly animate to new snap 0
      ref.current.currentSnap = 0;
      setIsExpanded(false);
      animateTo(SCREEN_H - minH);
    } else if (!visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: SCREEN_H, useNativeDriver: true, damping: 20, stiffness: 200 }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
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

        // From half → dismiss
        if (g.dy > DISMISS_THRESHOLD && currentSnap === 0) {
          setIsExpanded(false);
          dismiss();
          return;
        }
        // From full → half
        if (g.dy > DISMISS_THRESHOLD && currentSnap === 1) {
          ref.current.currentSnap = 0;
          setIsExpanded(false);
          animateTo(SCREEN_H - mH);
          return;
        }
        // From half → full
        if (g.dy < -DISMISS_THRESHOLD && currentSnap === 0) {
          ref.current.currentSnap = 1;
          setIsExpanded(true);
          animateTo(SCREEN_H - xH);
          return;
        }

        // Snap back to current position
        const snapTo = currentSnap === 0 ? SCREEN_H - mH : SCREEN_H - xH;
        animateTo(snapTo);
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ ...styleOverlay, opacity: overlayOpacity }}>
          <Pressable style={{ flex: 1 }} onPress={dismiss} />
        </Animated.View>
        <Animated.View style={{
          position: "absolute", left: 0, right: 0, height: maxH,
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          transform: [{ translateY }],
          paddingBottom: insets.bottom,
        }}>
          {/* Safe area spacer — only when expanded to full screen */}
          {isExpanded && <View style={{ height: insets.top }} />}
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
            <View style={{ width: 40, height: 4, backgroundColor: "#4b5563", borderRadius: 2 }} />
          </View>
          <View style={{
            flex: 1,
            maxHeight: (isExpanded ? maxH : minH) - HANDLE_H - (isExpanded ? insets.top : 0) - insets.bottom,
          }}>
            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styleOverlay = {
  position: "absolute" as const,
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(0,0,0,0.6)",
};
