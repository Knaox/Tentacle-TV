import type { DisplayModeInfo } from "@tentacle-tv/shared";
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
}

/**
 * Le mode que la lecture garde à l'écran — null : ne rien demander, le
 * téléphone décide seul. Règle de Damien (07/10), mesurée sur un OPPO
 * Find X3 Pro (ColorOS 14, 60/72/90/120 Hz) : le système fait tomber toute
 * vidéo à 60 Hz, et la demande de la cadence du film (72 Hz pour 24 i/s) y
 * était refusée. Donc :
 * - réglage ACTIVÉ : l'écran garde sa fréquence la plus haute (120 Hz) pendant
 *   toute la lecture, dans sa définition courante — fluide pour tout film ;
 * - réglage DÉSACTIVÉ : rien n'est demandé, le téléphone fait comme pour toute
 *   vidéo (souvent 60 Hz).
 * iOS : rien (un écran ProMotion se règle seul).
 */
export function fluidDisplayMode({ platform, enabled, screen }: FluidDisplayInput): DisplayModeInfo | null {
  if (platform !== "android" || !enabled || !screen || screen.currentModeId === undefined) return null;
  const current = screen.modes.find((mode) => mode.id === screen.currentModeId);
  if (!current) return null;
  let best: DisplayModeInfo | null = null;
  for (const mode of screen.modes) {
    if (mode.width !== current.width || mode.height !== current.height) continue;
    if (!best || mode.refreshRate > best.refreshRate) best = mode;
  }
  return best;
}
