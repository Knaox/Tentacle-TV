import { useEffect, useCallback } from "react";
import { BackHandler, Platform } from "react-native";

interface TVRemoteOptions {
  onBack?: () => void;
  onPlayPause?: () => void;
  onLeft?: () => void;
  onRight?: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /** Called on any D-pad direction or select — useful for re-showing overlays */
  onAnyPress?: () => void;
}

/**
 * Hook for handling TV remote events.
 * Handles back/menu, play/pause, select, and D-pad arrows.
 */
export function useTVRemote({
  onBack, onPlayPause, onLeft, onRight, onUp, onDown, onAnyPress,
}: TVRemoteOptions) {
  // Handle Android TV back button
  useEffect(() => {
    if (!onBack || Platform.OS !== "android") return;

    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });

    return () => handler.remove();
  }, [onBack]);

  const handleTVEvent = useCallback(
    (evt: { eventType: string }) => {
      switch (evt.eventType) {
        case "menu":
        case "back":
          onBack?.();
          break;
        case "playPause":
          onPlayPause?.();
          break;
        case "left":
          onLeft?.();
          onAnyPress?.();
          break;
        case "right":
          onRight?.();
          onAnyPress?.();
          break;
        case "up":
          onUp?.();
          onAnyPress?.();
          break;
        case "down":
          onDown?.();
          onAnyPress?.();
          break;
        case "select":
          onAnyPress?.();
          break;
      }
    },
    [onBack, onPlayPause, onLeft, onRight, onUp, onDown, onAnyPress]
  );

  useEffect(() => {
    // Try to use TVEventHandler if available (react-native-tvos)
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TVEventHandler } = require("react-native");
      if (TVEventHandler) {
        const handler = new TVEventHandler();
        handler.enable(undefined, (_cmp: unknown, evt: { eventType: string }) => {
          handleTVEvent(evt);
        });
        return () => handler.disable();
      }
    } catch {
      // Not available in standard RN
    }

    try {
      const { TVEventControl } = require("react-native");
      if (TVEventControl?.enableTVMenuKey) {
        TVEventControl.enableTVMenuKey();
        return () => TVEventControl.disableTVMenuKey();
      }
    } catch {
      // Not available in standard RN
    }
  }, [handleTVEvent]);
}
