import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * VoiceOver ou TalkBack sont-ils actifs ? Un message qui s'efface seul ne
 * laisse pas à un lecteur d'écran le temps d'être lu : il reste alors jusqu'à
 * ce qu'on le ferme.
 */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then((value) => { if (alive) setEnabled(value); }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}
