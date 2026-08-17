// Le pas de base vit désormais dans @tentacle-tv/shared (pasDeScrub) :
// PROPORTIONNEL à la durée du média, partagé avec le scrub webOS.
/** Paliers d'accélération du curseur selon la durée du hold (secondes) */
export const SPEED_TIERS = [1, 2, 4, 8] as const;

export function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}
