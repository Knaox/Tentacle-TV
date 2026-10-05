import { contentFrameRate, isPlausibleFrameRate, type MediaStream as JfStream } from "@tentacle-tv/shared";
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
