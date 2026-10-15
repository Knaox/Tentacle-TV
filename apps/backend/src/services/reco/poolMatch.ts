import type { PoolEntry } from "./generationJob";

/** Correspondance (match) du premier et du dernier du pool : monotone avec le rang. */
export const MATCH_TOP = 95;
export const MATCH_TAIL = 50;
/** Proximité aux goûts (relevance) qui autorise la correspondance pleine. */
export const MATCH_FULL_RELEVANCE = 0.5;
/** Correspondance d'un titre sans aucune proximité aux goûts, au mieux. */
export const MATCH_CEILING_FLOOR = 60;

/**
 * La correspondance de chaque entrée d'un pool CLASSÉ : son rang (95 en tête,
 * 50 en queue), plafonné par la proximité aux goûts — classé haut par sa seule
 * notoriété (une procédurale du catalogue), un titre ne s'annonce pas à 88 %.
 * Le plafond rend la correspondance NON monotone avec le rang : c'est elle, pas
 * le rang, que suit l'ordre d'affichage des rangées (`rowSelection.inDisplayOrder`).
 */
export function assignMatches(ranked: PoolEntry[]): void {
  const span = Math.max(1, ranked.length - 1);
  ranked.forEach((entry, i) => {
    const rank = MATCH_TOP - ((MATCH_TOP - MATCH_TAIL) * i) / span;
    const kin = Math.min(1, (entry.breakdown.relevance ?? 0) / MATCH_FULL_RELEVANCE);
    entry.match = Math.round(Math.min(rank, MATCH_CEILING_FLOOR + (MATCH_TOP - MATCH_CEILING_FLOOR) * kin));
  });
}
