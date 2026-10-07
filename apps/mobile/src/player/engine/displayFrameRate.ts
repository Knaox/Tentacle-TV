import { DISPLAY_MODE_RELATIVE_TOLERANCE, type DisplayModeInfo } from "@tentacle-tv/shared";
import type { MobilePlatform } from "./types";

/** Ce que l'écran dit de lui (`getDisplayModes`, Android) — la forme de `DisplaySnapshot`. */
export interface ScreenModes {
  currentModeId?: number;
  modes: readonly DisplayModeInfo[];
  seamlessRefreshRates?: readonly number[] | null;
  matchPreference?: "always" | "seamless" | "never";
}

export interface FluidDisplayInput {
  platform: MobilePlatform;
  /** Le réglage d'appareil « Adapter la fréquence de l'écran ». */
  enabled: boolean;
  screen: ScreenModes | null;
  /** La cadence du film (Jellyfin, sinon mpv) ; 0 ou absente : inconnue. */
  fps?: number;
}

/**
 * Le mode que la lecture demande à l'écran — null : ne rien demander, le
 * téléphone décide seul. Règle de Damien (07/10) : toujours le MEILLEUR que
 * l'écran sait faire, dans sa définition courante.
 * - un mode EXACTEMENT à la cadence du film (24 Hz pour un film à 24 i/s,
 *   23,976 compris) : on le prend ;
 * - sinon, la fréquence la plus haute de l'écran : 120 reste 120, 90 reste
 *   90, un écran 30/60 passe à 60.
 * Mesuré sur un OPPO Find X3 Pro (ColorOS 14, 60/72/90/120 Hz) : sans
 * demande, toute vidéo y tombe à 60 Hz, et la demande de 72 Hz (3 × 24) y
 * était refusée. Réglage DÉSACTIVÉ : rien n'est demandé. iOS : rien (un écran
 * ProMotion se règle seul).
 */
export function fluidDisplayMode({ platform, enabled, screen, fps = 0 }: FluidDisplayInput): DisplayModeInfo | null {
  if (platform !== "android" || !enabled || !screen || screen.currentModeId === undefined) return null;
  const current = screen.modes.find((mode) => mode.id === screen.currentModeId);
  if (!current) return null;
  const candidates = screen.modes.filter((mode) => mode.width === current.width && mode.height === current.height);
  if (fps > 0) {
    const exact = candidates.find((mode) => Math.abs(mode.refreshRate - fps) <= DISPLAY_MODE_RELATIVE_TOLERANCE * fps);
    if (exact) return exact;
  }
  let best: DisplayModeInfo | null = null;
  for (const mode of candidates) {
    if (!best || mode.refreshRate > best.refreshRate) best = mode;
  }
  return best;
}
