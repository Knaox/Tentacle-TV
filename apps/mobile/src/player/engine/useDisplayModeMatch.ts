import { useEffect } from "react";
import { Platform } from "react-native";
import { getDisplayModes, setPreferredDisplayMode } from "../../../modules/mpv-player";
import { fluidDisplayMode } from "./displayFrameRate";
import { useEngineSettings } from "./engineSettings";

const PLATFORM = Platform.OS === "android" ? "android" : "ios";

/**
 * Tant que le lecteur est monté, quel que soit le moteur : réglage activé, la
 * fenêtre garde l'écran à sa fréquence la plus haute (`fluidDisplayMode`) ;
 * le mode est rendu au démontage (sortie du lecteur) et quand le réglage se
 * coupe. Réglage coupé ou iOS : rien.
 */
export function useDisplayModeMatch(): void {
  const { matchFrameRate } = useEngineSettings();

  useEffect(() => {
    const mode = fluidDisplayMode({ platform: PLATFORM, enabled: matchFrameRate, screen: getDisplayModes() });
    if (!mode) return undefined;
    setPreferredDisplayMode(mode.id);
    return () => setPreferredDisplayMode(0);
  }, [matchFrameRate]);
}

/** La fréquence que la surface de mpv demande (0 : rien) — la même que la fenêtre. */
export function useFluidRefreshRate(): number {
  const { matchFrameRate } = useEngineSettings();
  return fluidDisplayMode({ platform: PLATFORM, enabled: matchFrameRate, screen: getDisplayModes() })?.refreshRate ?? 0;
}
