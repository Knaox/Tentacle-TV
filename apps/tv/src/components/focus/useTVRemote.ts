import { useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

// react-native-tvos 0.76 exports useTVEventHandler as a hook (not a class)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useTVEventHandler } = require("react-native") as {
  useTVEventHandler: (callback: (evt: { eventType: string; eventKeyAction?: number }) => void) => void;
};

interface TVRemoteOptions {
  onBack?: () => void;
  onPlayPause?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /** Called on long-press D-pad left (Android TV emits once after ~300ms hold) */
  onLongLeft?: () => void;
  /** Called on long-press D-pad right (Android TV emits once after ~300ms hold) */
  onLongRight?: () => void;
  /** Called on key-up (ACTION_UP) for any event type — used to detect release */
  onKeyUp?: (eventType: string) => void;
  /** Called on rewind button (dedicated Shield remote button) */
  onRewind?: () => void;
  /** Called on fast-forward button (dedicated Shield remote button) */
  onFastForward?: () => void;
  /** Called on any D-pad direction or select — useful for re-showing overlays */
  onAnyPress?: () => void;
}

/**
 * Hook for handling TV remote events.
 * Uses react-native-tvos useTVEventHandler hook.
 *
 * Note: react-native-tvos sends most events as action=1 (key-up only).
 * Only longLeft/longRight arrive as action=0 (key-down).
 */
export function useTVRemote(options: TVRemoteOptions) {
  // Store latest callbacks in ref to avoid stale closures
  const optRef = useRef(options);
  optRef.current = options;

  // Handle Android TV back button
  useEffect(() => {
    if (!options.onBack || Platform.OS !== "android") return;
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      optRef.current.onBack?.();
      return true;
    });
    return () => handler.remove();
  }, [options.onBack]);

  // Handle all TV remote events
  useTVEventHandler((evt: { eventType: string; eventKeyAction?: number }) => {
    const o = optRef.current;
    const { eventType, eventKeyAction } = evt;

    // Ignore focus system noise
    if (eventType === "blur" || eventType === "focus") return;

    // Key-up: notify for hold release detection
    if (eventKeyAction === 1) {
      o.onKeyUp?.(eventType);
      // longLeft/longRight already fired on key-down (action=0) — don't re-trigger
      if (eventType === "longLeft" || eventType === "longRight") return;
      // Block up/down/menu/back on key-up — these should NOT fire on action=1
      // (otherwise key-up "down" triggers onDown → scrubbing mode, breaking DPAD seek)
      if (eventType === "up" || eventType === "down" || eventType === "menu" || eventType === "back") return;
      // Only let directional seeks and playback controls fall through on key-up
    }

    switch (eventType) {
      case "menu":
      case "back":
        o.onBack?.();
        break;
      case "playPause":
        o.onPlayPause?.();
        break;
      case "left":
        o.onLeft?.();
        o.onAnyPress?.();
        break;
      case "right":
        o.onRight?.();
        o.onAnyPress?.();
        break;
      case "up":
        o.onUp?.();
        o.onAnyPress?.();
        break;
      case "down":
        o.onDown?.();
        o.onAnyPress?.();
        break;
      case "longLeft":
        o.onLongLeft?.();
        break;
      case "longRight":
        o.onLongRight?.();
        break;
      case "rewind":
        o.onRewind?.();
        o.onAnyPress?.();
        break;
      case "fastForward":
        o.onFastForward?.();
        o.onAnyPress?.();
        break;
      case "select":
        o.onAnyPress?.();
        break;
    }
  });
}
