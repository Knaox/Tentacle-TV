import { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { contentFrameRate, type MediaStream as JfStream } from "@tentacle-tv/shared";
import { getDisplayModes, setPreferredDisplayMode } from "../../../modules/mpv-player";
import { fluidDisplayMode } from "./displayFrameRate";
import { useEngineSettings } from "./engineSettings";

const PLATFORM = Platform.OS === "android" ? "android" : "ios";

/** Le mode visé pendant la lecture (`fluidDisplayMode`), ou null. */
function useTargetMode(streams: readonly JfStream[], loadedFps?: number) {
  const { matchFrameRate } = useEngineSettings();
  const fps = contentFrameRate(streams) ?? loadedFps ?? 0;
  return useMemo(
    () => fluidDisplayMode({ platform: PLATFORM, enabled: matchFrameRate, screen: getDisplayModes(), fps }),
    [matchFrameRate, fps],
  );
}

/**
 * Tant que le lecteur est monté, quel que soit le moteur : réglage activé, la
 * fenêtre demande le meilleur mode de l'écran (`fluidDisplayMode`) ; il est
 * rendu au démontage (sortie du lecteur) et quand le réglage se coupe.
 * Réglage coupé ou iOS : rien.
 */
export function useDisplayModeMatch(streams: readonly JfStream[]): void {
  const modeId = useTargetMode(streams)?.id ?? 0;
  useEffect(() => {
    if (modeId === 0) return undefined;
    setPreferredDisplayMode(modeId);
    return () => setPreferredDisplayMode(0);
  }, [modeId]);
}

/** La fréquence que la surface de mpv demande (0 : rien) — celle du mode de la fenêtre. */
export function useFluidRefreshRate(streams: readonly JfStream[], loadedFps?: number): number {
  return useTargetMode(streams, loadedFps)?.refreshRate ?? 0;
}
