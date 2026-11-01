import type { Anchor } from "./anchorTypes";

/**
 * La CONFIANCE du profil (`signalCount`, lue par les états froid / tiède /
 * prêt du service) : l'ENGAGEMENT réel du compte, pas seulement ses gestes.
 * Chaque signal d'un titre compte (vu, noté, en favori : trois), plus un
 * signal par tranche de HOURS_PER_SIGNAL heures regardées — vingt heures
 * d'une seule série en binge ne laissent plus le compte « froid » (un seul
 * signal), cent quarante heures ne le laissent plus « tiède ».
 */
export const HOURS_PER_SIGNAL = 3;

/** Pur : la confiance d'un profil, d'après ses ancres. */
export function engagementSignalCount(anchors: readonly Anchor[]): number {
  let kinds = 0;
  let hours = 0;
  for (const a of anchors) {
    kinds += a.kinds.length;
    // Les heures d'un titre refusé ou abandonné ne disent pas un goût.
    if (a.consumption && a.weight > 0) hours += a.hours;
  }
  return kinds + Math.floor(hours / HOURS_PER_SIGNAL);
}
