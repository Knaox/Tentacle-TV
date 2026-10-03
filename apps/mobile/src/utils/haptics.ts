import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { androidHapticFor, iosHapticFor, type HapticCue, type IosHaptic } from "./hapticCues";

export type { HapticCue } from "./hapticCues";

function playIos(effect: IosHaptic): Promise<void> {
  switch (effect.kind) {
    case "impact":
      return Haptics.impactAsync(effect.style as Haptics.ImpactFeedbackStyle);
    case "selection":
      return Haptics.selectionAsync();
    case "notification":
      return Haptics.notificationAsync(effect.type as Haptics.NotificationFeedbackType);
  }
}

/**
 * Le SEUL point de l'app qui fait vibrer : un signal d'intention, traduit par
 * plateforme (`hapticCues.ts`, qui dit aussi QUAND vibrer). Jamais d'erreur :
 * un retour haptique manqué ne doit rien interrompre.
 */
export function haptic(cue: HapticCue): void {
  try {
    const played = Platform.OS === "android"
      ? Haptics.performAndroidHapticsAsync(androidHapticFor(cue, Number(Platform.Version)) as Haptics.AndroidHaptics)
      : playIos(iosHapticFor(cue));
    played.catch(() => undefined);
  } catch {
    // Module natif absent : rien à jouer.
  }
}
