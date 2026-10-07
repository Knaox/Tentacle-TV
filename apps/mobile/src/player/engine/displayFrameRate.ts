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
 * téléphone décide seul. Règle de Damien (07/10) : le MEILLEUR MULTIPLE que
 * l'écran sait faire, dans sa définition courante.
 * - le plus grand multiple EXACT de la cadence du film (k = 1..5) : un film à
 *   24 i/s → 120 Hz (5 × 24), sinon 72, 48 ou 24 ; 30 i/s → 120, 90 ou 60 ;
 * - aucun multiple exact (24 i/s sur un écran 60/90) : la fréquence la plus
 *   haute, la plus fluide.
 * Mesuré sur un OPPO Find X3 Pro (ColorOS 14, 60/72/90/120 Hz) : sans
 * demande, toute vidéo y tombe à 60 Hz, et 72 Hz y était refusé — 120 Hz y
 * est le meilleur multiple de 24. Réglage DÉSACTIVÉ : rien n'est demandé.
 * iOS : rien (un écran ProMotion se règle seul).
 */
export function fluidDisplayMode({ platform, enabled, screen, fps = 0 }: FluidDisplayInput): DisplayModeInfo | null {
  if (platform !== "android" || !enabled || !screen || screen.currentModeId === undefined) return null;
  const current = screen.modes.find((mode) => mode.id === screen.currentModeId);
  if (!current) return null;
  const candidates = screen.modes.filter((mode) => mode.width === current.width && mode.height === current.height);
  const multiples = fps > 0 ? candidates.filter((mode) => isExactMultiple(mode.refreshRate, fps)) : [];
  return highest(multiples.length > 0 ? multiples : candidates);
}

const MAX_MULTIPLE = 5;

function isExactMultiple(refreshRate: number, fps: number): boolean {
  for (let k = 1; k <= MAX_MULTIPLE; k += 1) {
    if (Math.abs(refreshRate - k * fps) <= DISPLAY_MODE_RELATIVE_TOLERANCE * k * fps) return true;
  }
  return false;
}

function highest(modes: readonly DisplayModeInfo[]): DisplayModeInfo | null {
  let best: DisplayModeInfo | null = null;
  for (const mode of modes) {
    if (!best || mode.refreshRate > best.refreshRate) best = mode;
  }
  return best;
}
