import {
  contentFrameRate, isPlausibleFrameRate, pickDisplayMode,
  type DisplayModeInfo, type MediaStream as JfStream,
} from "@tentacle-tv/shared";
import type { MobilePlatform } from "./types";

export interface DisplayFrameRateInput {
  platform: MobilePlatform;
  /** Le réglage d'appareil « Adapter la fréquence de l'écran ». */
  enabled: boolean;
  /** Les flux Jellyfin de la source (serveur ou instantané du hors ligne). */
  streams: readonly JfStream[];
  /** La cadence que mpv lit du conteneur (`container-fps`), une fois le fichier ouvert. */
  loadedFps?: number;
}

/**
 * La cadence que le lecteur avancé demande à l'écran — 0 : rien demander.
 * Android seulement : sur iOS, rien ne change. La cadence de Jellyfin
 * d'abord (exacte, règle partagée `contentFrameRate`), celle de mpv en repli
 * — un fichier dont Jellyfin ne connaît pas la cadence en a toujours une.
 */
export function displayFrameRate({ platform, enabled, streams, loadedFps }: DisplayFrameRateInput): number {
  if (platform !== "android" || !enabled) return 0;
  const fromServer = contentFrameRate(streams);
  if (fromServer !== undefined) return fromServer;
  return isPlausibleFrameRate(loadedFps) ? loadedFps : 0;
}

/** Ce que l'écran dit de lui (`getDisplayModes`, Android) — la forme de `DisplaySnapshot`. */
export interface ScreenModes {
  currentModeId?: number;
  modes: readonly DisplayModeInfo[];
  seamlessRefreshRates?: readonly number[] | null;
  matchPreference?: "always" | "seamless" | "never";
}

/**
 * Le mode que la FENÊTRE demande pendant la lecture, quel que soit le moteur
 * — 0 : ne rien demander. La règle du mode est partagée (`pickDisplayMode`) ;
 * ici, ce que le téléphone permet : la préférence système « jamais » est
 * respectée, « sans coupure seulement » écarte un mode qu'Android ne sait pas
 * joindre sans couper l'image, et un écran déjà au bon mode n'est pas épinglé.
 */
export function windowDisplayMode(fps: number, screen: ScreenModes | null): number {
  if (!(fps > 0) || !screen || screen.currentModeId === undefined) return 0;
  if (screen.matchPreference === "never") return 0;
  const target = pickDisplayMode(fps, screen.currentModeId, screen.modes);
  if (!target || target.id === screen.currentModeId) return 0;
  const seamless = screen.seamlessRefreshRates;
  if (screen.matchPreference === "seamless" && seamless && !seamless.some((hz) => Math.abs(hz - target.refreshRate) < 0.01)) {
    return 0;
  }
  return target.id;
}
