/**
 * L'instantané du verre natif, pour le banc (`globalThis.__tentacleGlass`,
 * hors paquet seulement — voir `install.ts`).
 *
 * Il relit les VRAIES vues d'AppKit : « aucune région native quand le réglage
 * est coupé » doit se prouver par ce que la fenêtre porte, pas par ce que le
 * gestionnaire croit.
 */

import type { LiquidGlassAvailability } from "./availability";
import type { GlassInspection } from "./backend";
import type { NativeGlassRegion } from "./protocol";

/** Une région : ce que la page a demandé, et ce qu'AppKit porte. */
export interface RegionSnapshot {
  id: string;
  level: string;
  group: string | null;
  z: number;
  /** Ce que la page a demandé, en px CSS. */
  css: { x: number; y: number; width: number; height: number; radius: number };
  /** Le cadre de la vue, en points (origine en BAS à gauche) — `null` sans vue. */
  frame: { x: number; y: number; width: number; height: number } | null;
  radius: number | null;
  style: number | null;
  /** Vue absente, cachée, ou transparente. */
  hidden: boolean;
}

/** L'état d'une fenêtre. */
export interface RegionsSnapshot {
  /** Le réglage de l'utilisateur, tel que la page l'a dit. */
  enabled: boolean;
  /** La surface de Chromium est transparente : le verre peut se voir. */
  surfaceVisible: boolean;
  /** Une racine est posée sous le compositeur. */
  root: boolean;
  groups: number;
  /** `NSGlassEffectView` réellement présentes, comptées dans AppKit. */
  nativeViews: number;
  regions: RegionSnapshot[];
}

/** Ce que rend `__tentacleGlass.snapshot()`. */
export interface GlassSnapshot extends RegionsSnapshot {
  supported: boolean;
  availability: LiquidGlassAvailability;
  refractsVideo: boolean;
}

/** Une région décrite : ce que la page a demandé, et ce qu'AppKit porte (`null` sans vue). */
export function describeRegion(region: NativeGlassRegion, native: GlassInspection | null): RegionSnapshot {
  return {
    id: region.id,
    level: region.level,
    group: region.group ?? null,
    z: region.z,
    css: { x: region.x, y: region.y, width: region.width, height: region.height, radius: region.radius },
    frame: native?.frame ?? null,
    radius: native?.radius ?? null,
    style: native?.style ?? null,
    hidden: native === null || native.hidden,
  };
}
