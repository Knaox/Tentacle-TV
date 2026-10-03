import { useMemo, useRef } from "react";
import { PanResponder, type PanResponderInstance } from "react-native";
import { useAnimatedStyle, useSharedValue, withSpring, withTiming, runOnJS } from "react-native-reanimated";

/** Un geste à peine esquissé ne prend pas la main aux boutons de la carte. */
const START_THRESHOLD = 8;
/** Vers le haut, ou franchement sur le côté : la carte part. */
const DISMISS_UP = -28;
const DISMISS_SIDE = 90;

/**
 * Glisser pour fermer : la carte suit le doigt (vers le haut, ou sur le côté)
 * et part au-delà d'un seuil ; en deçà, elle revient. Jamais le seul moyen de
 * fermer : la croix reste là.
 */
export function useSwipeDismiss(onDismiss: () => void): {
  panHandlers: PanResponderInstance["panHandlers"];
  style: ReturnType<typeof useAnimatedStyle>;
} {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const responder = useMemo(() => {
    const leave = () => dismissRef.current();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) =>
        Math.abs(gesture.dy) > START_THRESHOLD || Math.abs(gesture.dx) > START_THRESHOLD * 1.5,
      onPanResponderMove: (_event, gesture) => {
        // Vers le bas, la carte résiste : elle n'a nulle part où aller.
        y.value = gesture.dy < 0 ? gesture.dy : gesture.dy * 0.15;
        x.value = gesture.dx;
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dy < DISMISS_UP || Math.abs(gesture.dx) > DISMISS_SIDE) {
          const sideways = Math.abs(gesture.dx) > Math.abs(gesture.dy);
          if (sideways) x.value = withTiming(Math.sign(gesture.dx) * 480, { duration: 160 }, () => runOnJS(leave)());
          else y.value = withTiming(-220, { duration: 160 }, () => runOnJS(leave)());
          return;
        }
        x.value = withSpring(0, { damping: 18, stiffness: 260 });
        y.value = withSpring(0, { damping: 18, stiffness: 260 });
      },
      onPanResponderTerminate: () => {
        x.value = withSpring(0);
        y.value = withSpring(0);
      },
    });
  }, [x, y]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
    opacity: 1 - Math.min(0.6, (Math.abs(x.value) + Math.max(0, -y.value)) / 300),
  }));
  return { panHandlers: responder.panHandlers, style };
}
