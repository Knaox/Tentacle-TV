import { useEffect, useRef } from "react";
import { findNodeHandle, Platform, UIManager } from "react-native";
import type { View } from "react-native";

export function useFocusRecovery(
  fallbackRef: React.RefObject<View | null>,
  enabled = true,
) {
  const hasFocusRef = useRef(true);

  useEffect(() => {
    if (Platform.OS !== "android" || !enabled) return;

    try {
      const { TVEventHandler } = require("react-native");
      if (!TVEventHandler) return;

      let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
      const handler = new TVEventHandler();

      handler.enable(undefined, (_cmp: unknown, evt: { eventType: string }) => {
        if (evt.eventType === "blur") {
          recoveryTimer = setTimeout(() => {
            const node = findNodeHandle(fallbackRef.current);
            if (node != null) {
              try { UIManager.sendAccessibilityEvent(node, 8); } catch {}
            }
          }, 500);
        } else if (evt.eventType === "focus") {
          if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; }
          hasFocusRef.current = true;
        }
      });

      return () => {
        handler.disable();
        if (recoveryTimer) clearTimeout(recoveryTimer);
      };
    } catch { return; }
  }, [fallbackRef, enabled]);
}
