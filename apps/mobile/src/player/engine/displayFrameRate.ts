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
 * téléphone décide seul. Règle de Damien (07/10) : le MEILLEUR MULTIPLE de la
 * cadence du film que l'écran sait faire, dans sa définition courante.
 *
 * « Meilleur » se mesure : l'écart de chaque image à l'écran, en temps —
 * |fréquence ÷ cadence − multiple entier le plus proche| ÷ fréquence. Un
 * multiple exact vaut 0 ; à égalité, la fréquence la plus haute. D'où :
 * 24 i/s → 120 Hz (5 × 24) plutôt que 72 ; 30 i/s → 120, 90 ou 60 ; sans
 * multiple exact, le plus proche : 24 i/s sur un écran 60/90 → 90 (2,8 ms
 * contre 8,3), 25 i/s sur 60/72/90/120 → 120 (1,7 ms, comme 72). Cadence
 * inconnue : la fréquence la plus haute.
 *
 * Mesuré sur un OPPO Find X3 Pro (ColorOS 14) : sans demande, toute vidéo y
 * tombe à 60 Hz, et 72 Hz y était refusé. Réglage DÉSACTIVÉ : rien n'est
 * demandé. iOS : rien (un écran ProMotion se règle seul).
 */
export function fluidDisplayMode({ platform, enabled, screen, fps = 0 }: FluidDisplayInput): DisplayModeInfo | null {
  if (platform !== "android" || !enabled || !screen || screen.currentModeId === undefined) return null;
  const current = screen.modes.find((mode) => mode.id === screen.currentModeId);
  if (!current) return null;
  let best: DisplayModeInfo | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const mode of screen.modes) {
    if (mode.width !== current.width || mode.height !== current.height) continue;
    const gap = fps > 0 ? cadenceGap(mode.refreshRate, fps) : 0;
    if (gap < bestGap - GAP_EPSILON || (Math.abs(gap - bestGap) <= GAP_EPSILON && mode.refreshRate > (best?.refreshRate ?? 0))) {
      best = mode;
      bestGap = gap;
    }
  }
  return best;
}

/** Deux écarts à moins de 0,05 ms l'un de l'autre se valent. */
const GAP_EPSILON = 0.05;

/** L'écart d'une image à l'écran, en millisecondes (0 : multiple exact). */
function cadenceGap(refreshRate: number, fps: number): number {
  const ratio = refreshRate / fps;
  const k = Math.max(1, Math.round(ratio));
  if (Math.abs(refreshRate - k * fps) <= DISPLAY_MODE_RELATIVE_TOLERANCE * k * fps) return 0;
  return (Math.abs(ratio - k) / refreshRate) * 1000;
}
