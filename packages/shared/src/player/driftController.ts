import {
  WT_DRIFT_HARD_S, WT_DRIFT_PAUSED_S, WT_DRIFT_TAU_S, WT_RATE_MAX_DEV, WT_RATE_STEP,
  WT_SOFT_CORRECTION_TIMEOUT_MS,
} from "../types/watchTogether";

/**
 * La correction de dérive d'un lecteur en séance — la décision seule, sans
 * lecteur ni horloge : ce qu'il faut faire de la vitesse, et s'il faut sauter.
 *
 * Un contrôleur proportionnel : `vitesse = 1 − dérive / τ`, bornée à ±5 %.
 * En avance (dérive > 0), on ralentit ; en retard, on accélère. Une zone
 * morte (`engageS`) évite de courir après le bruit de mesure, une hystérésis
 * (`settleS` < `engageS`) évite de battre : une fois engagée, la correction
 * tient jusqu'à ce que la dérive soit résorbée. Au-delà de WT_DRIFT_HARD_S,
 * ou si la douceur n'a rien résorbé en WT_SOFT_CORRECTION_TIMEOUT_MS, on
 * saute. En pause, la vitesse revient à 1 et seul un écart franc se recale.
 */

export interface DriftInput {
  /** Position du lecteur − position de la salle (secondes, > 0 = en avance). */
  driftS: number;
  paused: boolean;
  /** Vitesse actuellement appliquée au lecteur. */
  currentRate: number;
  /** Zone morte d'engagement et de relâchement (secondes, settle < engage). */
  engageS: number;
  settleS: number;
  /** Depuis combien de temps une correction douce court (ms), null sinon. */
  correctingForMs: number | null;
}

export interface DriftDecision {
  /** Vitesse à appliquer (1 = normale). */
  rate: number;
  /** `hard` : sauter à la position de la salle (plus le lookahead de seek) ;
   *  `paused` : se recaler en pause, exactement. */
  seek: "none" | "hard" | "paused";
}

/** La vitesse proportionnelle à la dérive, bornée et arrondie au pas. */
export function proportionalRate(driftS: number): number {
  const deviation = Math.max(-WT_RATE_MAX_DEV, Math.min(WT_RATE_MAX_DEV, driftS / WT_DRIFT_TAU_S));
  const rate = 1 - deviation;
  // `toFixed` : 190 × 0,005 rend 0,9500000000000001 — une vitesse doit se
  // comparer, et se dédupliquer, à l'égalité stricte.
  return Number((Math.round(rate / WT_RATE_STEP) * WT_RATE_STEP).toFixed(3));
}

export function decideDrift(input: DriftInput): DriftDecision {
  const abs = Math.abs(input.driftS);
  if (input.paused) {
    return { rate: 1, seek: abs > WT_DRIFT_PAUSED_S ? "paused" : "none" };
  }
  if (abs >= WT_DRIFT_HARD_S) return { rate: 1, seek: "hard" };
  const stuck = input.correctingForMs !== null && input.correctingForMs > WT_SOFT_CORRECTION_TIMEOUT_MS;
  if (stuck && abs > input.settleS) return { rate: 1, seek: "hard" };
  const engaged = input.currentRate !== 1;
  if (abs > input.engageS || (engaged && abs > input.settleS)) {
    return { rate: proportionalRate(input.driftS), seek: "none" };
  }
  return { rate: 1, seek: "none" };
}
