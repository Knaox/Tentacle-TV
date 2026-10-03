// Simulacre de @react-navigation/native : l'écran du lecteur est toujours
// focalisé ; `usePreventRemove` est noté (Android : il retient Menu).
import { useEffect } from "react";

export const __nav = {
  preventing: false,
  onChange: null as null | ((on: boolean) => void),
};

export function useIsFocused(): boolean {
  return true;
}

export function usePreventRemove(enabled: boolean, _callback: () => void): void {
  useEffect(() => {
    if (__nav.preventing === enabled) return;
    __nav.preventing = enabled;
    __nav.onChange?.(enabled);
  }, [enabled]);
}
