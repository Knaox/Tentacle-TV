import type { PoolEntry } from "./generationJob";

/** Correspondance (match) du premier et du dernier du pool : monotone avec le rang. */
export const MATCH_TOP = 95;
export const MATCH_TAIL = 50;
/** Proximité aux goûts (relevance) qui autorise la correspondance pleine. */
export const MATCH_FULL_RELEVANCE = 0.5;
/** Correspondance d'un titre sans aucune proximité aux goûts, au mieux. */
export const MATCH_CEILING_FLOOR = 60;

/** Plafond de la correspondance d'un profil à peine assez fourni (le seuil du
 *  « froid ») ; il remonte vers MATCH_TOP à mesure que les signaux s'ajoutent. */
export const MATCH_CONFIDENCE_FLOOR = 72;
/** Signaux sous lesquels la page n'est pas personnalisée (cf. serveContext). */
const CONFIDENCE_MIN_SIGNALS = 5;
/** Signaux qui réduisent de 63 % l'écart au plafond plein. */
const CONFIDENCE_SCALE_SIGNALS = 15;

/**
 * Pur : la meilleure correspondance qu'un profil de `signalCount` signaux peut
 * annoncer — 72 % au seuil du froid, ~83 % à 15, ~91 % à 30, 95 % au-delà de
 * 60. Un profil maigre ne connaît pas assez le compte pour dire « 94 % ».
 */
export function matchCeilingOf(signalCount: number): number {
  const extra = Math.max(0, signalCount - CONFIDENCE_MIN_SIGNALS) / CONFIDENCE_SCALE_SIGNALS;
  return MATCH_TOP - (MATCH_TOP - MATCH_CONFIDENCE_FLOOR) * Math.exp(-extra);
}

/**
 * La correspondance de chaque entrée d'un pool CLASSÉ : son rang (95 en tête,
 * 50 en queue), plafonné par la proximité aux goûts — classé haut par sa seule
 * notoriété (une procédurale du catalogue), un titre ne s'annonce pas à 88 %.
 * Le plafond rend la correspondance NON monotone avec le rang : c'est elle, pas
 * le rang, que suit l'ordre d'affichage des rangées (`rowSelection.inDisplayOrder`).
 * La confiance du profil (`signalCount`, absent = pleine) COMPRIME ensuite
 * l'échelle au-dessus de la queue : l'ordre ne change pas, la tête s'annonce
 * au plafond du profil (cf. matchCeilingOf).
 */
export function assignMatches(ranked: PoolEntry[], signalCount = Infinity): void {
  const span = Math.max(1, ranked.length - 1);
  const squeeze = (matchCeilingOf(signalCount) - MATCH_TAIL) / (MATCH_TOP - MATCH_TAIL);
  ranked.forEach((entry, i) => {
    const rank = MATCH_TOP - ((MATCH_TOP - MATCH_TAIL) * i) / span;
    const kin = Math.min(1, (entry.breakdown.relevance ?? 0) / MATCH_FULL_RELEVANCE);
    const raw = Math.min(rank, MATCH_CEILING_FLOOR + (MATCH_TOP - MATCH_CEILING_FLOOR) * kin);
    entry.match = Math.round(MATCH_TAIL + (raw - MATCH_TAIL) * squeeze);
  });
}
