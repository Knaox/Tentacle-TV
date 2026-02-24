import { useEffect, useCallback } from "react";
import { BackHandler, Platform } from "react-native";

interface TVRemoteOptions {
  onBack?: () => void;
  onPlayPause?: () => void;
}

/**
 * Hook for handling TV remote events.
 * Handles the back/menu button and play/pause button.
 */
export function useTVRemote({ onBack, onPlayPause }: TVRemoteOptions) {
  // Handle Android TV back button
  useEffect(() => {
    if (!onBack || Platform.OS !== "android") return;

    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });

    return () => handler.remove();
  }, [onBack]);

  // react-native-tvos provides useTVEventHandler for remote events.
  // We use a try/catch import pattern since this module may not exist
  // in standard RN (only in react-native-tvos fork).
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
      }
    },
    [onBack, onPlayPause]
  );

  useEffect(() => {
    // Try to use useTVEventHandler if available (react-native-tvos)
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
