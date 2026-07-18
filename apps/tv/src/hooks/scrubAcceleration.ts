export const SCRUB_STEP_SECONDS = 10;
/** Paliers d'accélération du curseur selon la durée du hold (secondes) */
export const SPEED_TIERS = [1, 2, 4, 8] as const;

export function getSpeedTier(holdStartTime: number): number {
  const elapsed = (Date.now() - holdStartTime) / 1000;
  const tier = Math.min(SPEED_TIERS.length - 1, Math.floor(elapsed));
  return SPEED_TIERS[tier];
}
