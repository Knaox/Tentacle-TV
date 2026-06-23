export const SCRUB_STEP_SECONDS = 10;
/** Paliers d'accélération du curseur selon la durée du hold (secondes) */
export const SPEED_TIERS = [1, 2, 4, 8] as const;

export function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}

/** Saut de base d'un appui-bouton FF/rewind (avant que la rampe ne démarre). */
export const BUTTON_SEEK_BASE = 10;
/** Rampe d'avance au MAINTIEN d'un bouton FF/rewind : vitesse (s vidéo / s réelle)
 *  selon la durée du maintien — de plus en plus rapide. */
export function buttonSeekRate(heldSec: number, durationSec: number): number {
  if (heldSec < 0.35) return 0;   // avant rampe : seul le saut de base s'applique
  // Rampe ∝ durée (bornée 5–400 s/s) : traverse la vidéo en ~30 s à fond → court = lent, long = rapide.
  const maxRate = Math.min(400, Math.max(5, (durationSec || 0) / 30));
  if (heldSec < 1.2) return maxRate * 0.18;
  if (heldSec < 2.2) return maxRate * 0.45;
  if (heldSec < 3.5) return maxRate * 0.75;
  return maxRate;
}
export function buttonSeekTier(heldSec: number): number {
  if (heldSec < 1.2) return 1;
  if (heldSec < 2.2) return 2;
  if (heldSec < 3.5) return 4;
  return 8;
}
