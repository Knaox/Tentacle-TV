/**
 * Octave — les mesures du bas de l'écran au téléphone : la barre d'onglets du
 * miroir (`TAB_BAR_HEIGHT`, 63) et le mini-lecteur (64), séparés de 8, posés à
 * `max(zone sûre, 10)` du bord. La page réserve cette place, plus un souffle.
 */

import { TAB_BAR_HEIGHT, TAB_MIN_BOTTOM_INSET } from "../../../../mirror/shell/metrics";

export const PHONE_BOTTOM_INSET = TAB_MIN_BOTTOM_INSET;
/** Hauteur du mini-lecteur : pochette 40 + 2 × 8, plus le filet de progression. */
export const MINI_PLAYER_HEIGHT = 58;
const GAP = 8;
const BREATH = 24;

/** Le bas de page à réserver, avec ou sans mini-lecteur. */
export function phoneBottomRoom(withMiniPlayer: boolean): string {
  const stack = TAB_BAR_HEIGHT + (withMiniPlayer ? MINI_PLAYER_HEIGHT + GAP : 0) + BREATH;
  return `calc(${stack}px + max(env(safe-area-inset-bottom, 0px), ${PHONE_BOTTOM_INSET}px))`;
}
