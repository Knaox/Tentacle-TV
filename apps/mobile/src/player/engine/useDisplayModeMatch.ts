import { useEffect, useMemo } from "react";
import { Platform } from "react-native";
import type { MediaStream as JfStream } from "@tentacle-tv/shared";
import { getDisplayModes, setPreferredDisplayMode } from "../../../modules/mpv-player";
import { displayFrameRate, windowDisplayMode } from "./displayFrameRate";
import { useEngineSettings } from "./engineSettings";

const PLATFORM = Platform.OS === "android" ? "android" : "ios";

/**
 * Le mode de la fenêtre calé sur la cadence du film, tant que le lecteur est
 * monté — quel que soit le moteur : ExoPlayer vote sur sa surface, mpv sur la
 * sienne, mais seule la fenêtre fait basculer un Android d'avant la 11 et un
 * écran que le vote seul ne décide pas. Le mode est rendu au démontage (sortie
 * du lecteur) et quand le réglage se coupe. iOS : rien.
 */
export function useDisplayModeMatch(streams: readonly JfStream[]): void {
  const { matchFrameRate } = useEngineSettings();
  const fps = useMemo(
    () => displayFrameRate({ platform: PLATFORM, enabled: matchFrameRate, streams }),
    [matchFrameRate, streams],
  );

  useEffect(() => {
    if (fps <= 0) return undefined;
    const modeId = windowDisplayMode(fps, getDisplayModes());
    if (modeId === 0) return undefined;
    setPreferredDisplayMode(modeId);
    return () => setPreferredDisplayMode(0);
  }, [fps]);
}
