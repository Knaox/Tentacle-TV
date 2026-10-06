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
 * — 0 : ne rien demander. La règle du mode est partagée (`pickDisplayMode`).
 *
 * Deux leçons du téléphone réel (OPPO Find X3 Pro, ColorOS 14, 60/120 Hz) :
 * - le mode est ÉPINGLÉ même quand l'écran y est déjà. L'app tournait à
 *   120 Hz au départ, donc rien n'était demandé — et le système redescendait
 *   à 60 Hz dès que la vidéo jouait, sans personne pour l'en empêcher ;
 * - la préférence système « Adapter la fréquence » ne filtre plus rien : elle
 *   gouverne l'adaptation AUTOMATIQUE au contenu (le vote de surface), pas une
 *   demande explicite de la fenêtre. Le seuil « sans coupure seulement »
 *   écartait le 120 Hz là où 60 ↔ 120 n'est pas annoncé comme sans coupure.
 *   Le réglage de Tentacle est le choix de l'utilisateur.
 */
export function windowDisplayMode(fps: number, screen: ScreenModes | null): number {
  if (!(fps > 0) || !screen || screen.currentModeId === undefined) return 0;
  return pickDisplayMode(fps, screen.currentModeId, screen.modes)?.id ?? 0;
}
